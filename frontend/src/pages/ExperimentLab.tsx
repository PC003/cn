import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Repeat, Loader2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Callout } from "../components/Callout";
import { ConfigPanel } from "../components/ConfigPanel";
import { MetricCard } from "../components/Metric";
import { SessionCharts } from "../components/SessionCharts";
import { TrialsTable } from "../components/TrialsTable";
import { Button, NumberField } from "../components/Field";
import { BackendGate, ErrorNote } from "../components/Notices";
import { useLab } from "../state/LabContext";
import { api } from "../services/api";
import type { TrialsResult } from "../types/sim";
import { fmt } from "../utils/format";

export default function ExperimentLab() {
  const { config, result, running, error, run } = useLab();
  const [nTrials, setNTrials] = useState(30);
  const [trials, setTrials] = useState<TrialsResult | null>(null);
  const [trialsBusy, setTrialsBusy] = useState(false);
  const [trialsErr, setTrialsErr] = useState<string | null>(null);

  const runTrials = async () => {
    if (!config) return;
    setTrialsBusy(true);
    setTrialsErr(null);
    try {
      setTrials(await api.trials(config, nTrials));
    } catch (e) {
      setTrialsErr((e as Error).message);
    } finally {
      setTrialsBusy(false);
    }
  };

  const m = result?.metrics;
  return (
    <div>
      <PageHeader
        eyebrow="Simulator"
        title="Experiment Lab"
        subtitle="Configure the network, transport, video and ABR settings, then run a seeded streaming session. Every number below is measured from the simulator run."
      />
      <BackendGate>
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            <ConfigPanel />
          </div>

          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void run()} disabled={running}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run session
                </Button>
                <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <div className="w-24">
                  <NumberField label="Trials" min={2} max={100} value={nTrials} onChange={setNTrials} />
                </div>
                <div className="pt-4">
                  <Button variant="secondary" onClick={() => void runTrials()} disabled={trialsBusy}>
                    {trialsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
                    Run {nTrials} seeds
                  </Button>
                </div>
                <p className="basis-full text-[11px] text-text-muted">
                  Trials run seeds {config?.seed}…{(config?.seed ?? 0) + nTrials - 1} with an otherwise identical
                  configuration and report mean, standard deviation and a 95% t-interval.
                </p>
              </div>
            </Card>

            <ErrorNote message={error ?? trialsErr} />

            {!result && !running && (
              <Callout variant="note" title="No run yet">
                Press <strong>Run session</strong>. The result is also available in{" "}
                <Link to="/results" className="text-accent underline">Results</Link>, and stored in{" "}
                <Link to="/experiment-history" className="text-accent underline">Experiment History</Link>.
              </Callout>
            )}

            {result && m && (
              <>
                <section>
                  <h2 className="mb-2 text-sm font-semibold">
                    {result.transport_label} · {m.abr}-based ABR · seed {m.seed}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    <MetricCard label="QoE score" value={fmt(m.qoe, 1)} unit="/ 100" />
                    <MetricCard label="Avg bitrate" value={fmt(m.avg_bitrate_mbps)} unit="Mbps" />
                    <MetricCard label="Startup delay" value={fmt(m.startup_delay_s)} unit="s" />
                    <MetricCard label="Rebuffering" value={fmt(m.rebuffer_s)} unit="s"
                      hint={`${m.rebuffer_events} event(s)`} tone={m.rebuffer_s > 0 ? "bad" : "good"} />
                    <MetricCard label="Switches" value={m.bitrate_switches} />
                    <MetricCard label="Mean goodput" value={fmt(m.mean_throughput_mbps)} unit="Mbps" />
                    <MetricCard label="Retransmissions" value={m.retransmissions}
                      hint={`${m.timeouts} timeouts, ${m.fast_retransmits} fast`} />
                    <MetricCard label="HOL blocking" value={fmt(m.hol_blocked_packet_s, 1)} unit="pkt·s" />
                  </div>
                </section>
                <Card>
                  <SessionCharts result={result} />
                </Card>
              </>
            )}

            {trials && (
              <Card>
                <h2 className="mb-3 text-sm font-semibold">
                  Repeated trials · {trials.protocol.toUpperCase()}-like · {trials.abr} ABR
                </h2>
                <TrialsTable trials={trials} />
              </Card>
            )}
          </div>
        </div>
      </BackendGate>
    </div>
  );
}
