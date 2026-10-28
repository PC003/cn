import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LabProvider } from "./state/LabContext";
import Home from "./pages/Home";
import ExperimentLab from "./pages/ExperimentLab";
import TcpVsUdp from "./pages/TcpVsUdp";
import AbrLab from "./pages/AbrLab";
import LiveSimulation from "./pages/LiveSimulation";
import Results from "./pages/Results";
import WhatIf from "./pages/WhatIf";
import ExperimentHistory from "./pages/ExperimentHistory";
import Validation from "./pages/Validation";

export default function App() {
  return (
    <LabProvider>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/experiment-lab" element={<ExperimentLab />} />
        <Route path="/tcp-vs-udp" element={<TcpVsUdp />} />
        <Route path="/abr-lab" element={<AbrLab />} />
        <Route path="/live-simulation" element={<LiveSimulation />} />
        <Route path="/results" element={<Results />} />
        <Route path="/what-if" element={<WhatIf />} />
        <Route path="/experiment-history" element={<ExperimentHistory />} />
        <Route path="/validation" element={<Validation />} />
      </Route>
    </Routes>
    </LabProvider>
  );
}
