import { Toolbar as BaseHubToolbar } from "basehub/next-toolbar";
import { isSampleContent } from "../index";

// BaseHub's draft-mode toolbar has nothing to preview without a repository.
export const Toolbar = () => (isSampleContent ? null : <BaseHubToolbar />);
