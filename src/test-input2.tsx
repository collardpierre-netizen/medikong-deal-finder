export default function Test() {
  return (
    <td className="px-3 py-2">
      <input
        type="number" min={0} step={1}
        className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
        style={{ borderColor: "#E2E8F0" }}
        value={0}
        onChange={() => {}}
      />
    </td>
  );
}
