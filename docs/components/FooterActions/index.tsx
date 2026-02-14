import { ReleaseSwitcher } from "../ReleaseSwitcher";
import { ThemeSwitch } from "nextra-theme-docs";

export const FooterActions = () => {
  return (
    <div className="flex items-center flex-wrap gap-4 w-full">
      <div>
        <ThemeSwitch />
      </div>
      <div className="block ms-auto md:hidden">
        <ReleaseSwitcher variant="light" />
      </div>
    </div>
  );
};
