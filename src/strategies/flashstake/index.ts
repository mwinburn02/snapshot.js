import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';
import { multicall, subgraphRequest } from '../../utils';

const FLASHSTAKE_SUBGRAPH_URL = {
  '1':
    'https://api.thegraph.com/subgraphs/name/blockzerohello/flash-stake-stats-v2-subgraph'
};

export const author = 'anassohail99';
export const version = '0.1.0';

export async function strategy(
  _space,
  network,
  _provider,
  addresses,
  options,
  snapshot
) {
  const params = {
    users: {
      __args: {
        where: {
          id_in: addresses.map((address) => address.toLowerCase())
        },
        first: 1000
      },
      id: true,
      liquidityPositions: {
        liquidityTokenBalance: true,
        user: {
          id: true
        },
        pair: {
          id: true,
          token0: {
            id: true
          },
          reserve0: true,
          token1: {
            id: true
          },
          reserve1: true,
          totalSupply: true
        }
      }
    }
  };

  const params2 = {
    stakes: {
      __args: {
        where: {
          user_in: addresses.map((address) => address.toLowerCase())
        }
      },
      id: true,
      amountIn: true,
      user: true
    }
  };

  if (snapshot !== 'latest') {
    // @ts-ignore
    params.users.__args.block = { number: snapshot };
    // @ts-ignore
    params2.stakes.__args.block = { number: snapshot };
  }
  const result = await subgraphRequest(
    FLASHSTAKE_SUBGRAPH_URL[network],
    params
  );

  const stakesResult = await subgraphRequest(
    FLASHSTAKE_SUBGRAPH_URL[network],
    params2
  );

  let score = {};
  if (stakesResult && stakesResult.stakes) {
    stakesResult.stakes.map((_data) => {
      if (!score[_data.user]) score[_data.user] = 0;
      score[_data.user] = Number(score[_data.user]) + Number(_data.amountIn);
    });
  }

  if (result && result.users) {
    result.users.map((_data) => {
      if (_data.liquidityPositions[0]?.pair) {
        _data.liquidityPositions.map((__data) => {

          const token0perFlash =
            Number(__data.pair.reserve0) / Number(__data.pair.totalSupply);
          const userScore =
            token0perFlash * Number(__data.liquidityTokenBalance);
          if (!score[__data.user.id]) score[__data.user.id] = 0;
          score[__data.user.id] = Number(score[__data.user.id]) + userScore;

        });
      }
    });
  }

  return score || {};
}
