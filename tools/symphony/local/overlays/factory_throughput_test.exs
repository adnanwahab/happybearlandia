defmodule SymphonyElixirWeb.FactoryThroughputTest do
  use ExUnit.Case, async: false
  import Phoenix.LiveViewTest
  alias SymphonyElixirWeb.FactoryThroughput

  setup do
    original = System.get_env("HBL_SYMPHONY_THROUGHPUT_PATH")
    directory = Path.join(System.tmp_dir!(), "factory-metrics-#{System.unique_integer([:positive])}")
    File.mkdir_p!(directory)
    path = Path.join(directory, "snapshot.json")
    System.put_env("HBL_SYMPHONY_THROUGHPUT_PATH", path)

    on_exit(fn ->
      if original, do: System.put_env("HBL_SYMPHONY_THROUGHPUT_PATH", original), else: System.delete_env("HBL_SYMPHONY_THROUGHPUT_PATH")
      File.rm_rf!(directory)
    end)

    %{path: path, directory: directory}
  end

  test "missing, malformed and broadly readable snapshots stay unavailable", %{path: path} do
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
    File.write!(path, "not JSON")
    File.chmod!(path, 0o600)
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
    File.write!(path, Jason.encode!(%{schema_version: 1, runtime: "invalid"}))
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
    File.write!(path, Jason.encode!(%{schema_version: 1, generated_at: System.os_time(:second)}))
    File.chmod!(path, 0o644)
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
    File.chmod!(path, 0o600)
    assert FactoryThroughput.snapshot()["schema_version"] == 1
    System.put_env("HBL_SYMPHONY_THROUGHPUT_PATH", "relative.json")
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
  end

  test "read-only controller returns no-store JSON" do
    conn = Plug.Test.conn(:get, "/api/v1/throughput")
    options = SymphonyElixirWeb.FactoryThroughputController.init(:index)
    result = SymphonyElixirWeb.FactoryThroughputController.call(conn, options)
    assert result.status == 200
    assert Plug.Conn.get_resp_header(result, "cache-control") == ["no-store"]
    assert Jason.decode!(result.resp_body) == %{"unavailable" => true}
  end

  test "symlink snapshot is refused", %{path: path, directory: directory} do
    target = Path.join(directory, "target.json")
    File.write!(target, Jason.encode!(%{schema_version: 1}))
    File.chmod!(target, 0o600)
    File.ln_s!(target, path)
    assert FactoryThroughput.snapshot() == %{"unavailable" => true}
  end

  test "panel renders unknowns honestly and escapes event text" do
    assert is_map(FactoryThroughput.__components__())
    missing = render_component(&FactoryThroughput.panel/1, data: nil)
    assert missing =~ "Metrics unavailable or stale"
    assert missing =~ "unavailable"

    payload = %{
      "schema_version" => 1,
      "generated_at" => System.os_time(:second),
      "runtime" => %{"running" => 0, "max_workers" => 1, "workers" => [%{"issue" => "SHE-1", "stage" => "testing", "elapsed_seconds" => 2}]},
      "queue" => %{"blocking_reasons" => [%{"reason" => "ownership", "count" => 2}]},
      "utilization" => %{"fraction" => 0.125},
      "resources" => %{"cpu_load_ratio" => "not-a-number"},
      "watchdog" => [%{"code" => "resource-pressure", "severity" => "hold"}],
      "timeline" => [%{"at" => System.os_time(:second), "issue" => "<script>bad</script>", "stage" => "pr_opened", "source" => "github"}, %{"at" => nil}, %{"at" => 1.0e30}]
    }

    rendered = render_component(&FactoryThroughput.panel/1, data: payload)
    assert rendered =~ "Development factory throughput"
    assert rendered =~ "0.125"
    assert rendered =~ "&lt;script&gt;"
    refute rendered =~ "<script>bad"
    refute rendered =~ "Metrics unavailable or stale"
  end
end
