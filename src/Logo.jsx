import { COMPANY } from "./brand.js";

// Renders your company logo (public/logo.png) at a given pixel height; width scales.
export default function Logo({ size = 40 }) {
  return (
    <img
      src="/logo.png"
      alt={COMPANY}
      style={{ height: size, width: "auto", display: "block" }}
    />
  );
}
