import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { MsicStakeChange, MsicStake } from "../../generated/schema";

import { decimalize, DECIMAL_ZERO, BIGINT_ZERO } from "../utils/bignumbers";

import {
  decreaseNumberOfActiveMSICStakes,
  increaseNumberOfActiveMSICStakes,
  increaseTotalNumberOfMSICStakes
} from "./Global";

import { getUser } from "./User";
import { beginChange, initChange, finishChange } from "./Change";
import { updateSystemStateByMsicStakeChange } from "./SystemState";

function startMSICStakeChange(event: ethereum.Event): MsicStakeChange {
  let sequenceNumber = beginChange();
  let stakeChange = new MsicStakeChange(sequenceNumber.toString());
  stakeChange.issuanceGain = DECIMAL_ZERO;
  stakeChange.redemptionGain = DECIMAL_ZERO;
  initChange(stakeChange, event, sequenceNumber);
  return stakeChange;
}

function finishMSICStakeChange(stakeChange: MsicStakeChange): void {
  finishChange(stakeChange);
  stakeChange.save();
}

function getUserStake(address: Address): MsicStake | null {
  let user = getUser(address);

  if (user.stake == null) {
    return null;
  }

  return MsicStake.load(user.stake);
}

function createStake(address: Address): MsicStake {
  let user = getUser(address);
  let stake = new MsicStake(address.toHexString());

  stake.owner = user.id;
  stake.amount = DECIMAL_ZERO;

  user.stake = stake.id;
  user.save();

  return stake;
}

function getOperationType(stake: MsicStake | null, nextStakeAmount: BigDecimal): string {
  let isCreating = stake.amount == DECIMAL_ZERO && nextStakeAmount > DECIMAL_ZERO;
  if (isCreating) {
    return "stakeCreated";
  }

  let isIncreasing = nextStakeAmount > stake.amount;
  if (isIncreasing) {
    return "stakeIncreased";
  }

  let isRemoving = nextStakeAmount == DECIMAL_ZERO;
  if (isRemoving) {
    return "stakeRemoved";
  }

  return "stakeDecreased";
}

export function updateStake(event: ethereum.Event, address: Address, newStake: BigInt): void {
  let stake = getUserStake(address);
  let isUserFirstStake = stake == null;

  if (stake == null) {
    stake = createStake(address);
  }

  let nextStakeAmount = decimalize(newStake);

  let stakeChange = startMSICStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.stakeOperation = getOperationType(stake, nextStakeAmount);
  stakeChange.stakedAmountBefore = stake.amount;
  stakeChange.stakedAmountChange = nextStakeAmount.minus(stake.amount);
  stakeChange.stakedAmountAfter = nextStakeAmount;

  stake.amount = nextStakeAmount;

  if (stakeChange.stakeOperation == "stakeCreated") {
    if (isUserFirstStake) {
      increaseTotalNumberOfMSICStakes();
    } else {
      increaseNumberOfActiveMSICStakes();
    }
  } else if (stakeChange.stakeOperation == "stakeRemoved") {
    decreaseNumberOfActiveMSICStakes();
  }

  updateSystemStateByMsicStakeChange(stakeChange);
  finishMSICStakeChange(stakeChange);

  stake.save();
}

export function withdrawStakeGains(
  event: ethereum.Event,
  address: Address,
  MoUSDGain: BigInt,
  ETHGain: BigInt
): void {
  if (MoUSDGain == BIGINT_ZERO && ETHGain == BIGINT_ZERO) {
    return;
  }

  let stake = getUserStake(address) || createStake(address);
  let stakeChange: MsicStakeChange = startMSICStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.stakeOperation = "gainsWithdrawn";
  stakeChange.issuanceGain = decimalize(MoUSDGain);
  stakeChange.redemptionGain = decimalize(ETHGain);
  stakeChange.stakedAmountBefore = stake.amount;
  stakeChange.stakedAmountChange = DECIMAL_ZERO;
  stakeChange.stakedAmountAfter = stake.amount;

  updateSystemStateByMsicStakeChange(stakeChange);
  finishMSICStakeChange(stakeChange);

  stake.save();
}
