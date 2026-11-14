export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SPINNER_SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return <span className={`loading loading-spinner ${SPINNER_SIZE_CLASS[size]} ${className}`} />;
}
