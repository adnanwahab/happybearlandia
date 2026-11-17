defmodule SymphonyElixirWeb.FactoryThroughput do
  @moduledoc "Read-only projection of the trusted host's redacted factory metrics."
  use Phoenix.Component
  import Bitwise

  @spec snapshot() :: map()
  def snapshot do
    path =
      System.get_env("HBL_SYMPHONY_THROUGHPUT_PATH") ||
        Path.expand("~/.local/state/hbl-publisher/backlog-coordinator/throughput.json")

    with true <- Path.type(path) == :absolute,
         {:ok, stat} <- File.lstat(path),
         true <- stat.type == :regular and stat.size <= 1_048_576 and band(stat.mode, 0o077) == 0,
         {:ok, bytes} <- File.read(path),
         {:ok, %{"schema_version" => 1} = data} <- Jason.decode(bytes),
         true <- valid_snapshot?(data) do
      data
    else
      _ -> %{"unavailable" => true}
    end
  end

  defp valid_snapshot?(data) do
    maps = ~w(runtime queue rates cycle_times utilization resources tokens api quality inventory)
    lists = [data["timeline"] || [], data["watchdog"] || [], get_in(data, ["runtime", "workers"]) || [], get_in(data, ["queue", "blocking_reasons"]) || []]

    Enum.all?(maps, &is_map(Map.get(data, &1, %{}))) and
      Enum.all?(lists, fn values -> is_list(values) and length(values) <= 1000 and Enum.all?(values, &is_map/1) end)
  rescue
    _ -> false
  end

  @spec panel(map()) :: Phoenix.LiveView.Rendered.t()
  def panel(assigns) do
    data = assigns[:data] || %{}
    generated = data["generated_at"]
    stale = not is_number(generated) or System.os_time(:second) - generated > 90
    assigns = assigns |> assign(:data, data) |> assign(:stale, stale) |> assign(:metrics, metrics(data)) |> assign(:timeline, Enum.take(Enum.reverse(data["timeline"] || []), 30))

    ~H"""
    <section class="section-card" id="factory-throughput" aria-label="Development factory throughput">
      <div class="section-header"><div>
        <h2 class="section-title">Development factory throughput</h2>
        <p class="section-copy">Observed host events and resource pressure. Queue estimates are not delivery promises.</p>
      </div></div>
      <p :if={@stale} class="empty-state">Metrics unavailable or stale; no capacity or delivery claim.</p>
      <div class="metric-grid">
        <article :for={{label, value} <- @metrics} class="metric-card">
          <p class="metric-label">{label}</p><p class="metric-value numeric">{value}</p>
        </article>
      </div>
      <p class="section-copy">Repository PR rates include coordinator work; Symphony-only rates require an exact Symphony issue branch. Small samples do not establish capacity. Inventory age is separate from current resource samples; API counts describe the last full scan.</p>
      <h3>Watchdog</h3>
      <ul><li :for={entry <- @data["watchdog"] || []}>{entry["code"]} · {entry["severity"]} {entry["issue"]}</li></ul>
      <h3>Blocking reasons</h3>
      <ul><li :for={entry <- get_in(@data, ["queue", "blocking_reasons"]) || []}>{entry["reason"]}: {entry["count"]}</li></ul>
      <h3>Current worker stages</h3>
      <ul><li :for={entry <- get_in(@data, ["runtime", "workers"]) || []}>{entry["issue"]} · {entry["stage"]} · {display(entry["elapsed_seconds"])} seconds</li></ul>
      <h3>Observed event timeline</h3>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>UTC time</th><th>Issue</th><th>Stage</th><th>Source</th></tr></thead>
        <tbody><tr :for={entry <- @timeline}><td>{event_time(entry["at"])}</td><td>{entry["issue"]}</td><td>{entry["stage"]}</td><td>{entry["source"]}</td></tr></tbody>
      </table></div>
    </section>
    """
  end

  defp metrics(data) do
    fields = [
      {"Active workers", ["runtime", "running"]},
      {"Configured workers", ["runtime", "max_workers"]},
      {"Ready", ["queue", "ready"]},
      {"Blocked", ["queue", "blocked"]},
      {"Retrying", ["runtime", "retrying"]},
      {"Remaining queue estimate", ["queue", "remaining_estimate"]},
      {"Repository PRs opened/hour", ["rates", "prs_opened_per_hour"]},
      {"Repository PRs merged/hour", ["rates", "prs_merged_per_hour"]},
      {"Symphony PRs opened/hour", ["rates", "symphony_prs_opened_per_hour"]},
      {"Symphony PRs merged/hour", ["rates", "symphony_prs_merged_per_hour"]},
      {"PR cycle median seconds", ["cycle_times", "median_seconds"]},
      {"PR cycle p95 seconds", ["cycle_times", "p95_seconds"]},
      {"PR cycle samples", ["cycle_times", "samples"]},
      {"First-pass CI fraction", ["quality", "first_pass_ci_success_rate"]},
      {"Retry fraction", ["quality", "retry_rate"]},
      {"Failure fraction", ["quality", "failure_rate"]},
      {"Observed utilization fraction", ["utilization", "fraction"]},
      {"Observed seconds", ["utilization", "observed_seconds"]},
      {"Total Codex tokens", ["tokens", "total"]},
      {"Observed tokens/second", ["tokens", "tokens_per_second"]},
      {"Linear reads/scan", ["api", "linear_reads"]},
      {"GitHub reads/scan", ["api", "github_reads"]},
      {"API retries", ["api", "retries"]},
      {"API throttles", ["api", "throttles"]},
      {"Scan seconds", ["api", "scan_seconds"]},
      {"Inventory age seconds", ["inventory", "age_seconds"]},
      {"Available RAM bytes", ["resources", "available_memory_bytes"]},
      {"Swap used bytes", ["resources", "swap_used_bytes"]},
      {"Free disk bytes", ["resources", "disk_free_bytes"]},
      {"CPU load / cores", ["resources", "cpu_load_ratio"]}
    ]

    Enum.map(fields, fn {label, path} -> {label, display(get_in(data, path))} end)
  end

  defp display(nil), do: "unavailable"
  defp display(value) when is_float(value), do: Float.round(value, 3) |> to_string()
  defp display(value) when is_integer(value), do: Integer.to_string(value)
  defp display(_value), do: "unavailable"

  defp event_time(value) when is_number(value) do
    case DateTime.from_unix(trunc(value)) do
      {:ok, date} -> DateTime.to_iso8601(date)
      _ -> "unavailable"
    end
  end

  defp event_time(_value), do: "unavailable"
end

defmodule SymphonyElixirWeb.FactoryThroughputController do
  @moduledoc "Read-only local throughput endpoint; never grants or mutates work."
  use Phoenix.Controller, formats: [:json]

  @spec index(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def index(conn, _params) do
    settings = SymphonyElixir.Config.settings!()

    data =
      Map.put(SymphonyElixirWeb.FactoryThroughput.snapshot(), "effective_configuration", %{
        "required_labels" => settings.tracker.required_labels,
        "max_concurrent_agents" => settings.agent.max_concurrent_agents,
        "max_turns" => settings.agent.max_turns,
        "workspace_root" => SymphonyElixir.Config.local_workspace_root(),
        "workflow_path" => SymphonyElixir.Workflow.workflow_file_path()
      })

    conn
    |> Plug.Conn.put_resp_header("cache-control", "no-store")
    |> json(data)
  end
end
