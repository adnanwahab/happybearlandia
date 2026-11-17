defmodule SymphonyElixir.AgentRunnerHandoffTest do
  use SymphonyElixir.TestSupport

  test "data-only handoff validation is bounded and rejects malformed and symlinked artifacts" do
    root = Path.join(System.tmp_dir!(), "handoff-validation-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(root, ".hbl-handoff"))
    on_exit(fn -> File.rm_rf(root) end)
    path = Path.join(root, ".hbl-handoff/workpad.json")
    assert :continue = AgentRunner.local_handoff_outcome(root)

    for status <- ["handoff", "blocked"] do
      File.write!(path, Jason.encode!(%{status: status, notes: "Validated local work"}))
      assert :stop = AgentRunner.local_handoff_outcome(root)
    end

    File.write!(path, Jason.encode!(%{status: "progress", notes: "Continuing"}))
    assert :continue = AgentRunner.local_handoff_outcome(root)

    for content <- [
          "{",
          Jason.encode!(%{status: "handoff", notes: ""}),
          Jason.encode!(%{status: "handoff", notes: String.duplicate("x", 40_001)}),
          Jason.encode!(%{status: "unknown", notes: "invalid status"}),
          String.duplicate("x", 262_145)
        ] do
      File.write!(path, content)
      assert {:error, :invalid_handoff} = AgentRunner.local_handoff_outcome(root)
    end

    File.rm!(path)
    File.ln_s!("/does-not-exist", path)
    assert {:error, :invalid_handoff} = AgentRunner.local_handoff_outcome(root)
    File.rm!(path)
    directory = Path.join(root, ".hbl-handoff")
    File.rename!(directory, Path.join(root, "elsewhere"))
    File.write!(Path.join(root, "elsewhere/workpad.json"), Jason.encode!(%{status: "handoff", notes: "symlinked parent"}))
    File.ln_s!(Path.join(root, "elsewhere"), directory)
    assert {:error, :invalid_handoff} = AgentRunner.local_handoff_outcome(root)
    File.rm!(Path.join(root, "elsewhere/workpad.json"))
    assert {:error, :invalid_handoff} = AgentRunner.local_handoff_outcome(root)
  end

  test "legacy handoff remains data-only and malformed competing data fails closed" do
    root = Path.join(System.tmp_dir!(), "handoff-legacy-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(root, ".git"))
    on_exit(fn -> File.rm_rf(root) end)
    File.write!(Path.join(root, ".git/hbl-workpad.json"), Jason.encode!(%{status: "handoff", notes: "Done"}))
    assert :stop = AgentRunner.local_handoff_outcome(root)
    File.mkdir_p!(Path.join(root, ".hbl-handoff"))
    File.write!(Path.join(root, ".hbl-handoff/workpad.json"), "invalid")
    assert {:error, :invalid_handoff} = AgentRunner.local_handoff_outcome(root)
  end

  test "incomplete turns retain one thread and workspace; handoff stops at first turn with one host hook" do
    for mode <- ["progress", "handoff", "blocked", "malformed"] do
      {issue, trace, hook, workspace} = fixture(mode)
      fetcher = fn [_] -> {:ok, [%{issue | state: "In Progress", dispatchable: true}]} end

      if mode == "malformed" do
        assert_raise RuntimeError, ~r/invalid_handoff/, fn ->
          AgentRunner.run(issue, self(), issue_state_fetcher: fetcher)
        end

        assert_receive {:codex_worker_update, _, %{event: :host_handoff_blocked, reason: :invalid_handoff}}
      else
        assert :ok = AgentRunner.run(issue, self(), issue_state_fetcher: fetcher)
      end

      messages = trace |> File.read!() |> String.split("\n", trim: true) |> Enum.map(&Jason.decode!/1)
      assert Enum.count(messages, &(&1["method"] == "thread/start")) == 1
      turns = Enum.filter(messages, &(&1["method"] == "turn/start"))
      assert length(turns) == if(mode == "progress", do: 20, else: 1)
      assert Enum.all?(turns, &(get_in(&1, ["params", "threadId"]) == "same-thread"))
      assert Enum.all?(turns, &(get_in(&1, ["params", "cwd"]) == elem(SymphonyElixir.PathSafety.canonicalize(workspace), 1)))
      assert File.read!(hook) == "after\n"
    end
  end

  test "after_run failure emits structured host recovery before worker failure" do
    {issue, _trace, _hook, _workspace} = fixture("handoff", "exit 23")
    assert_raise RuntimeError, ~r/Host after_run failed/, fn -> AgentRunner.run(issue, self()) end
    assert_receive {:codex_worker_update, _, %{event: :host_handoff_blocked, reason: :after_run_failed}}
  end

  defp fixture(mode, hook_command \\ nil) do
    root = Path.join(System.tmp_dir!(), "runner-handoff-#{System.unique_integer([:positive])}")
    File.mkdir_p!(root)
    on_exit(fn -> File.rm_rf(root) end)
    binary = Path.join(root, "fake-codex")
    trace = Path.join(root, "trace")
    hook = Path.join(root, "hook")

    File.write!(binary, """
    #!/usr/bin/python3
    import json,sys,pathlib
    for line in sys.stdin:
      req=json.loads(line)
      with open(#{inspect(trace)},'a') as f: f.write(json.dumps(req)+'\\n')
      method=req.get('method')
      if method=='initialize': result={}
      elif method=='thread/start': result={'thread':{'id':'same-thread'}}
      elif method=='turn/start':
        directory=pathlib.Path('.hbl-handoff');directory.mkdir(exist_ok=True)
        (directory/'workpad.json').write_text('invalid' if #{inspect(mode)}=='malformed' else json.dumps({'status':#{inspect(mode)},'notes':'local validation'}))
        result={'turn':{'id':'turn-id'}}
      else: continue
      print(json.dumps({'id':req['id'],'result':result}),flush=True)
      if method=='turn/start': print(json.dumps({'method':'turn/completed'}),flush=True)
    """)

    File.chmod!(binary, 0o755)

    write_workflow_file!(Workflow.workflow_file_path(),
      workspace_root: Path.join(root, "workspaces"),
      codex_command: "#{binary} app-server",
      hook_after_run: hook_command || "printf 'after\\n' >> #{hook}",
      max_turns: 20
    )

    issue = %Issue{id: "handoff-id", identifier: "MT-HANDOFF", title: "Local lifecycle", state: "In Progress", labels: []}
    {issue, trace, hook, Path.join(root, "workspaces/MT-HANDOFF")}
  end
end
