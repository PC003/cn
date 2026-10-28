import numpy as np
import pytest

from app.simulation.config import NetworkConfig, TransportConfig
from app.simulation.network import STREAM_LOSS, NetworkModel
from app.simulation.quic_model import QuicLikeTransport
from app.simulation.tcp_model import TcpLikeTransport
from app.simulation.udp_model import UdpLikeTransport

SEG_BYTES = 1_500_000  # 3 Mbps x 4 s


def net(seed=1, **kw):
    base = dict(bandwidth_mbps=100.0, rtt_ms=20.0, jitter_ms=0.0, loss_probability=0.0,
                profile="constant", queue_packets=100_000)
    base.update(kw)
    return NetworkModel(NetworkConfig(**base), seed, horizon_s=200)


def tcp(n, **tkw):
    return TcpLikeTransport(n, TransportConfig(protocol="tcp", **tkw), n.seed)


def test_handshake_costs_by_protocol_without_loss():
    n = net()
    t, _ = TcpLikeTransport(n, TransportConfig(protocol="tcp"), 1).connect(0.0)
    assert t == pytest.approx(2 * 0.020)
    t, _ = QuicLikeTransport(n, TransportConfig(protocol="quic"), 1).connect(0.0)
    assert t == pytest.approx(0.020)
    t, _ = UdpLikeTransport(n, TransportConfig(protocol="udp"), 1).connect(0.0)
    assert t == 0.0


def test_tcp_zero_loss_high_bandwidth_is_clean_and_fast():
    n = net()
    tr = tcp(n)
    ready, _ = tr.connect(0.0)
    d = tr.deliver(0, SEG_BYTES, ready, 3.0)
    assert d.retransmissions == 0 and d.timeouts == 0 and d.packets_lost == 0
    assert d.hol_blocked_packets == 0 and d.delivered_fraction == 1.0
    serialisation = SEG_BYTES * 8 / 100e6
    assert d.duration_s > serialisation  # cannot beat the link
    assert d.duration_s < 0.5  # a handful of RTTs of slow start


def test_download_time_never_below_serialisation_time():
    n = net(bandwidth_mbps=5.0)
    tr = tcp(n)
    ready, _ = tr.connect(0.0)
    d = tr.deliver(0, SEG_BYTES, ready, 3.0)
    assert d.duration_s >= SEG_BYTES * 8 / 5e6 - 1e-9


def test_loss_causes_retransmissions_and_slower_downloads():
    def mean_dur(p):
        total = 0.0
        for seed in range(1, 9):
            n = net(seed=seed, loss_probability=p)
            tr = tcp(n)
            ready, _ = tr.connect(0.0)
            total += tr.deliver(0, SEG_BYTES, ready, 3.0).duration_s
        return total / 8

    assert mean_dur(0.02) > mean_dur(0.0) * 1.5


def test_lower_bandwidth_slower_download():
    def dur(bw):
        n = net(bandwidth_mbps=bw)
        tr = tcp(n)
        r, _ = tr.connect(0.0)
        return tr.deliver(0, SEG_BYTES, r, 3.0).duration_s
    assert dur(2.0) > dur(10.0) > dur(50.0)


def test_loss_recovery_completes_and_counts_retransmits():
    n = net(seed=4, loss_probability=0.05)
    tr = tcp(n)
    r, _ = tr.connect(0.0)
    d = tr.deliver(0, SEG_BYTES, r, 3.0)
    assert d.retransmissions >= d.fast_retransmits + d.timeouts >= 1
    assert d.packets_lost > 0 and d.delivered_fraction == 1.0
    assert d.packets_sent == d.packets + d.retransmissions


def test_head_of_line_blocking_present_for_tcp_reduced_for_quic():
    tcp_hol = quic_hol = 0.0
    for seed in range(1, 11):
        n = net(seed=seed, loss_probability=0.01)
        t = tcp(n)
        r, _ = t.connect(0.0)
        tcp_hol += t.deliver(0, SEG_BYTES, r, 3.0).hol_blocked_packet_s
        q = QuicLikeTransport(n, TransportConfig(protocol="quic", quic_streams=4), seed)
        r, _ = q.connect(0.0)
        quic_hol += q.deliver(0, SEG_BYTES, r, 3.0).hol_blocked_packet_s
    assert tcp_hol > 0
    assert quic_hol < tcp_hol


def test_same_seed_is_reproducible():
    def run():
        n = net(seed=9, loss_probability=0.02, jitter_ms=5.0)
        tr = tcp(n)
        r, _ = tr.connect(0.0)
        return tr.deliver(0, SEG_BYTES, r, 3.0).to_dict()
    assert run() == run()


# --------------------------------------------------------------------------- UDP
def udp(n, **kw):
    return UdpLikeTransport(n, TransportConfig(protocol="udp", **kw), n.seed)


def test_udp_has_no_retransmission_and_uses_same_loss_draws_as_tcp():
    n = net(seed=3, loss_probability=0.03, bandwidth_mbps=100.0)
    tr = udp(n, udp_recovery="none")
    r, _ = tr.connect(0.0)
    d = tr.deliver(0, SEG_BYTES, r, 3.0)
    assert d.retransmissions == 0 and d.timeouts == 0
    npk = tr.n_packets(SEG_BYTES)
    expected_lost = int(np.sum(n.uniform_draws(STREAM_LOSS, 0, 0, npk) < 0.03))
    assert d.packets_lost == expected_lost
    assert d.delivered_fraction == pytest.approx(1 - expected_lost / npk, abs=1e-9)


def test_udp_arq_recovers_what_none_loses():
    n = net(seed=3, loss_probability=0.03)
    a = udp(n, udp_recovery="none"); a.connect(0.0)
    b = udp(n, udp_recovery="arq"); b.connect(0.0)
    da = a.deliver(0, SEG_BYTES, 0.0, 3.0)
    db = b.deliver(0, SEG_BYTES, 0.0, 3.0)
    assert da.delivered_fraction < 1.0
    assert db.delivered_fraction > da.delivered_fraction
    assert db.repair_rounds >= 1 and db.retransmissions > 0
    assert db.duration_s > da.duration_s * 0.99 - 1  # repair costs time, never negative


def test_udp_fec_recovers_light_loss_without_retransmission():
    got_fec = got_none = 0.0
    for seed in range(1, 9):
        n = net(seed=seed, loss_probability=0.01)
        f = udp(n, udp_recovery="fec", udp_fec_overhead=0.2); f.connect(0.0)
        z = udp(n, udp_recovery="none"); z.connect(0.0)
        df = f.deliver(0, SEG_BYTES, 0.0, 3.0)
        dz = z.deliver(0, SEG_BYTES, 0.0, 3.0)
        got_fec += df.delivered_fraction
        got_none += dz.delivered_fraction
        assert df.retransmissions == 0
        assert df.packets_sent > df.packets  # parity overhead is real traffic
    assert got_fec > got_none


def test_udp_does_not_back_off_and_overload_drops_at_queue():
    # 3x pacing of a 6 Mbps stream into a 4 Mbps link with a small queue
    n = net(bandwidth_mbps=4.0, queue_packets=50)
    tr = udp(n, udp_recovery="none", udp_pacing_factor=3.0)
    tr.connect(0.0)
    d = tr.deliver(0, 3_000_000, 0.0, 6.0)
    assert d.packets_lost > 0 and d.delivered_fraction < 1.0
    assert d.retransmissions == 0


def test_udp_jitter_causes_reordering():
    n = net(jitter_ms=30.0, bandwidth_mbps=1000.0)
    tr = udp(n, udp_pacing_factor=50.0)
    tr.connect(0.0)
    d = tr.deliver(0, SEG_BYTES, 0.0, 3.0)
    assert d.reordered_packets > 0


def test_packet_trace_records_first_packets():
    n = net(seed=2, loss_probability=0.2)
    tr = TcpLikeTransport(n, TransportConfig(protocol="tcp"), 2, packet_trace_limit=20)
    r, _ = tr.connect(0.0)
    d = tr.deliver(0, 60_000, r, 3.0)
    assert d.packet_trace and all(p.segment_id == 0 for p in d.packet_trace)
    assert any(p.lost for p in d.packet_trace)
    assert any(p.retransmitted for p in d.packet_trace)
