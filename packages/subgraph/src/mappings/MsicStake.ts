import { StakeChanged, StakingGainsWithdrawn } from "../../generated/MSICStaking/MSICStaking";

import { updateStake, withdrawStakeGains } from "../entities/MsicStake";

export function handleStakeChanged(event: StakeChanged): void {
  updateStake(event, event.params.staker, event.params.newStake);
}

export function handleStakeGainsWithdrawn(event: StakingGainsWithdrawn): void {
  withdrawStakeGains(event, event.params.staker, event.params.MEURGain, event.params.ETHGain);
}
