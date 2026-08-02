def shipping_fee(order_total, is_member=False):
    if order_total < 0:
        raise ValueError("order_total must be non-negative")
    if is_member or order_total >= 50:
        return 0
    return 5
