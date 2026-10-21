import { Text as PdfText } from "@react-pdf/renderer";
import { Children, type ComponentProps } from "react";

/** The PDF-text arm of react-pdf's props (its `Text` type also accepts SVG text props). */
type TextProps = Extract<ComponentProps<typeof PdfText>, { render?: unknown }>;
import { toPdfText } from "./pdf-text";

/**
 * react-pdf's `<Text>` with every string child passed through `toPdfText`, so runtime text (customer data,
 * translations) cannot print as garbage. PDF documents import `Text` from here, never from `@react-pdf/renderer`.
 */
export function Text({ children, render, ...rest }: TextProps) {
  // Only passed when set: react-pdf treats a present `render` key as a dynamic node, even when undefined.
  const dynamic = render
    ? {
        render: (page: Parameters<typeof render>[0]) => {
          const out = render(page);
          return typeof out === "string" ? toPdfText(out) : out;
        },
      }
    : {};
  return (
    <PdfText {...rest} {...dynamic}>
      {Children.map(children, (child) => (typeof child === "string" ? toPdfText(child) : child))}
    </PdfText>
  );
}
