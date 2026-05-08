export default function Test() {
  return (
    <button>
      <Check size={12} aria-hidden="true" />
      Text
    </button>
  );
}
function Check(props: any) { return <svg {...props} />; }
