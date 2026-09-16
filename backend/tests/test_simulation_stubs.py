"""
Review 1 sanity checks for the simulation package.

These modules are intentionally unimplemented (see each module's docstring).
The tests here only assert the packet data model shape and that calling a
stub raises NotImplementedError rather than silently returning a fabricated
result — this guards against the project ever accidentally "faking" results
before the real models exist.
"""

import pytest

from app.simulation import abr, buffer, congestion, experiment, qoe, tcp_model, udp_model
from app.simulation.network import sample_conditions
from app.simulation.packet import Packet


def test_packet_model_has_required_fields():
    p = Packet(
        packet_id=1,
        segment_id=0,
        sequence_number=0,
        size_bytes=1400,
        send_time=0.0,
    )
    assert p.lost is False
    assert p.delivered is False
    assert p.in_order is True


@pytest.mark.parametrize(
    "stub_call",
    [
        lambda: sample_conditions(time_s=0, seed=1),
        lambda: tcp_model.run_tcp_transfer(),
        lambda: udp_model.run_udp_transfer(),
        lambda: congestion.update_congestion_window(),
        lambda: buffer.step_buffer(),
        lambda: abr.choose_representation(),
        lambda: qoe.compute_qoe(),
        lambda: experiment.run_experiment(),
    ],
)
def test_unimplemented_simulation_stubs_raise_explicitly(stub_call):
    with pytest.raises(NotImplementedError):
        stub_call()
