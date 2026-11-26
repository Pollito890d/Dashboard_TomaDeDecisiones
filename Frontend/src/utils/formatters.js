export const formatCurrencyFull = (value) => {
  return '$ ' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export const formatMillionsAxis = (value) => {
  const millions = value / 1000000;
  return `$${millions.toFixed(1)} M`;
};
