import { Button } from "@/docs/components/Button";
import { DiscoveryButton } from "../DiscoveryButton";

export const CtaCard = () => (
  <div
    className={[
      "bg-hexos-azure-01 text-white flex flex-col gap-4",
      "max-w-[544px] p-8 text-left",
      "border border-hexos-grey-03 rounded-lg mt-8",
      "[&_p_a]:!text-[#6db5f8] [&_p_a:hover]:!text-[#93c5fa] [&_p_a:hover]:opacity-80",
    ].join(" ")}
    style={{
      backgroundImage: `url(https://res.cloudinary.com/measuredco/image/upload/v1732634892/site/site-background-top_v8ll2o.png), url(https://res.cloudinary.com/measuredco/image/upload/v1732635074/site/site-background-repeat_kjbjx5.png)`,
      backgroundPosition: "center -1rem, top",
      backgroundRepeat: "no-repeat, repeat-y",
      backgroundSize: "auto",
    }}
  >
    <h2 className="text-2xl font-bold leading-[1.2]" id="support">
      Stuck with Hexos?
    </h2>
    <p>We provide Hexos support, design system builds, and consultancy.</p>
    <div className="flex gap-3 flex-wrap">
      <DiscoveryButton />
      <Button href="https://discord.gg/D9e4E3MQVZ" variant="secondary" newTab>
        Join Discord — Free
      </Button>
    </div>
  </div>
);
