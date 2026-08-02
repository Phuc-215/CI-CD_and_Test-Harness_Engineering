from pricing import shipping_fee


def test_member_gets_free_shipping():
    assert shipping_fee(20, is_member=True) == 0
