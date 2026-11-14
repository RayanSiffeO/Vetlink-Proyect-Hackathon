export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SPINNER_SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-7 w-7 border-[2.5px]',
};

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      className={`vl-spinner inline-block shrink-0 ${SPINNER_SIZE_CLASS[size]} ${className}`}
      aria-hidden="true"
    />
  );
}

export default Spinner;
