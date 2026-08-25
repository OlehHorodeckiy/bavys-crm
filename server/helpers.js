const STATUS_PIPELINE = [
  { value: "new", label: "Новий" },
  { value: "confirmed", label: "Підтверджено" },
  { value: "advance_paid", label: "Аванс отримано" },
  { value: "completed", label: "Проведено" },
  { value: "paid", label: "Оплачено повністю" },
  { value: "cancelled", label: "Скасовано" },
];

function withOrderTotals(order) {
  const totalAmount =
    order.base_price + order.extra_services_fee + order.transport_fee - order.partner_discount;
  const remainingBalance =
    order.payment_status === "paid" ? 0 : Math.max(totalAmount - order.advance_amount, 0);
  return { ...order, total_amount: totalAmount, remaining_balance: remainingBalance };
}

module.exports = { STATUS_PIPELINE, withOrderTotals };
