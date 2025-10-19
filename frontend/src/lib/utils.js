import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num) {
  // Use apostrophe as thousand separator
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function evaluateFormula(formula, weight) {
  try {
    // Replace 'weight' with actual value and evaluate
    const expression = formula.replace(/weight/gi, weight.toString());
    // Simple math evaluation (supports basic operations)
    const result = eval(expression);
    return Math.round(result * 10) / 10; // Round to 1 decimal
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return 0;
  }
}

export function formatDate(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
