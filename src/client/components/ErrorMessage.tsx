type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="px-4 py-3 my-3 bg-red-400/10 border border-red-400/40 rounded-lg text-red-400 text-sm flex items-center justify-between gap-3"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 bg-transparent border border-red-400/50 rounded-md text-red-400 text-xs cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-red-400 mt-0.5">{message}</p>;
}