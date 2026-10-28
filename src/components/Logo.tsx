import Image from "next/image";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a aria-label="কুপি — বুঝলে আলো জ্বলে।" className="flex shrink-0 items-center" href="#">
      <span className="relative block h-10">
        <Image
          alt="কুপি"
          width={1204}
          height={516}
          className="h-10 w-auto"
          src={dark ? "/logo/kupi-logo-horizontal-bn-on-dark.png" : "/logo/kupi-logo-horizontal-bn.png"}
          priority={!dark}
        />
        <span
          aria-hidden="true"
          className="logo-flame-sway absolute"
          style={
            dark
              ? { left: "14.61794019933555%", top: "9.30232558139535%", width: "11.960132890365449%", height: "32.36434108527132%" }
              : { left: "14.867109634551495%", top: "10.271317829457365%", width: "11.378737541528238%", height: "31.3953488372093%" }
          }
        >
          <Image alt="" width={137} height={162} className="logo-flame-flicker size-full" src="/logo/kupi-lamp-flame.png" />
        </span>
      </span>
    </a>
  );
}
