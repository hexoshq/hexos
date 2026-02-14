import { GenerationInfo } from "./components/docs/GenerationInfo";
import { MemberInfo } from "./components/docs/MemberInfo";
import { LinkCard } from "./components/docs/LinkCard";

export function useMDXComponents(components: Record<string, unknown>) {
  return {
    ...components,
    GenerationInfo,
    MemberInfo,
    LinkCard,
  };
}
