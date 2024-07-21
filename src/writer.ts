import { validateAndParseAddress } from 'starknet';
import { starknet } from '@snapshot-labs/checkpoint';
import { formatUnits } from '@ethersproject/units';
import { Delegate, Governance } from '../.checkpoint/models';
import { BIGINT_ZERO, DECIMALS, getGovernanceIds, getGovernance, getDelegate } from './utils';

export const handleDelegateChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate changed', event);

  const fromDelegate = validateAndParseAddress(event.from_delegate);
  const toDelegate = validateAndParseAddress(event.to_delegate);

  for (const governanceId of getGovernanceIds(source)) {
    const previousDelegate: Delegate = await getDelegate(fromDelegate, governanceId);
    previousDelegate.tokenHoldersRepresentedAmount -= 1;
    await previousDelegate.save();

    const newDelegate: Delegate = await getDelegate(toDelegate, governanceId);
    newDelegate.tokenHoldersRepresentedAmount += 1;
    await newDelegate.save();
  }
};

export const handleDelegateVotesChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate votes changed', event);

  const votesDiff = BigInt(event.new_votes) - BigInt(event.previous_votes);

  for (const governanceId of getGovernanceIds(source)) {
    const delegate: Delegate = await getDelegate(
      validateAndParseAddress(event.delegate),
      governanceId
    );

    delegate.delegatedVotesRaw = (BigInt(delegate.delegatedVotesRaw) + votesDiff).toString();
    delegate.delegatedVotes = formatUnits(delegate.delegatedVotesRaw, DECIMALS);
    await delegate.save();

    const governance: Governance = await getGovernance(governanceId);

    if (event.previous_votes == BIGINT_ZERO && event.new_votes > BIGINT_ZERO)
      governance.currentDelegates += 1;

    if (event.new_votes == BIGINT_ZERO) governance.currentDelegates -= 1;

    governance.delegatedVotesRaw = (BigInt(governance.delegatedVotesRaw) + votesDiff).toString();
    governance.delegatedVotes = formatUnits(governance.delegatedVotesRaw, DECIMALS);
    await governance.save();
  }
};
