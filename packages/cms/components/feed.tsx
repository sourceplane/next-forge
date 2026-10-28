import { Pump } from "basehub/react-pump";
import type { ComponentProps } from "react";
import { isSampleContent } from "../index";
import { sampleResult } from "../sample";
import { SampleContentNotice } from "./sample-notice";

type PumpProps = ComponentProps<typeof Pump>;

// BaseHub's Pump, or — with no BaseHub repository connected — the same
// render function given the sample's results for the same queries
// (../sample.ts), under a notice saying what to connect.
const SampleFeed = async ({ queries, children }: PumpProps) => {
  const results = (queries as Record<string, unknown>[]).map(sampleResult);
  const render = children as unknown as (
    data: Record<string, unknown>[]
  ) => Promise<React.ReactNode> | React.ReactNode;
  return (
    <>
      <SampleContentNotice />
      {await render(results)}
    </>
  );
};

export const Feed = ((props: PumpProps) =>
  isSampleContent ? (
    <SampleFeed {...props} />
  ) : (
    <Pump {...props} />
  )) as unknown as typeof Pump;
