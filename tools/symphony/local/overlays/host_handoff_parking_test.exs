defmodule SymphonyElixir.HostHandoffParkingTest do
  use SymphonyElixir.TestSupport

  test "host handoff failures park instead of scheduling implementation retries" do
    write_workflow_file!(Workflow.workflow_file_path(), tracker_kind: "memory")

    for reason <- [:normal, {:shutdown, :after_run_failed}] do
      name = Module.concat(__MODULE__, "Park#{System.unique_integer([:positive])}")
      {:ok, pid} = Orchestrator.start_link(name: name)
      on_exit(fn -> if Process.alive?(pid), do: GenServer.stop(pid) end)
      ref = make_ref()
      issue = %Issue{id: "handoff-park", identifier: "MT-HANDOFF", state: "In Progress", dispatchable: true}

      entry = %{
        pid: self(),
        ref: ref,
        identifier: issue.identifier,
        issue: issue,
        started_at: DateTime.utc_now(),
        last_codex_event: :host_handoff_blocked
      }

      Application.put_env(:symphony_elixir, :memory_tracker_issues, [issue])
      :sys.replace_state(pid, fn state -> %{state | running: %{issue.id => entry}, claimed: MapSet.new([issue.id])} end)
      send(pid, {:DOWN, ref, :process, self(), reason})
      state = :sys.get_state(pid)
      assert state.running == %{}
      assert state.retry_attempts == %{}
      assert state.blocked[issue.id].error == "host handoff requires operator recovery; implementation parked"
      assert MapSet.member?(state.claimed, issue.id)
      send(pid, :tick)
      state = :sys.get_state(pid)
      assert state.blocked[issue.id].identifier == issue.identifier
      assert state.retry_attempts == %{}
    end
  end
end
