import * as React from 'react';
import { withTheme } from 'styled-components';
import { Box, BoxProps, Text } from 'grommet';
import { useHistory } from 'react-router';
import { observer } from 'mobx-react-lite';
import { IStyledChildrenProps } from 'interfaces';
import { Title } from '../Base/components/Title';
import { useStores } from '../../stores';
import * as styles from './styles.styl';
import cn from 'classnames';
import { TOKEN } from '../../stores/interfaces';

export const Head: React.FC<IStyledChildrenProps<BoxProps>> = withTheme(
  observer(({ theme, ...props }: IStyledChildrenProps<BoxProps>) => {
    const history = useHistory();
    const { routing, exchange } = useStores();
    const { palette, container } = theme;
    const { minWidth, maxWidth } = container;

    const isExplorer = history.location.pathname === '/explorer';
    const isSwap = history.location.pathname === '/swap';
    const isTokens = history.location.pathname === '/tokens';
    const isGetTokens = history.location.pathname === '/get-tokens';
    const isFaq = history.location.pathname === '/faq';
    const isInfo = history.location.pathname === '/info';
    const isEarn = history.location.pathname === '/earn';
    const isSeFi = history.location.pathname === '/sefi';

    const goToBridge = () => {
      routing.push(`/`);
    };

    return (
      <Box
        style={{
          background: palette.StandardWhite,
          // background: '#f6f7fb',
          overflow: 'visible',
          position: 'absolute',
          top: 0,
          width: '100%',
          zIndex: 100,
          minWidth,
          // boxShadow: '0px 0px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Box
          direction="row"
          align="center"
          justify="between"
          style={{
            minWidth,
            maxWidth,
            margin: '0 auto',
            padding: '0px 30px',
            height: 100,
            minHeight: 100,
            width: '100%',
          }}
        >
          <Box direction="row" align="center">
            {/* <Box
              align="center"
              margin={{ right: 'small' }}
              onClick={goToBridge}
            >
              <MainLogo src="/static/scrt.svg" />
            </Box> */}
            <a href="/" style={{ textDecoration: 'none' }}>
              <Box>
                <Title size="medium" color="BlackTxt" bold>
                  𝕊ecret Finance
                </Title>
              </Box>
            </a>
          </Box>
          <Box direction="row" align="center" gap="15px">
            <Box
              className={cn(
                styles.itemToken,
                !isInfo && !isFaq && !isExplorer && !isGetTokens && !isTokens && !isSwap && !isEarn && !isSeFi
                  ? styles.selected
                  : '',
              )}
              onClick={goToBridge}
            >
              <Text>Bridge</Text>
            </Box>

            <Box
              className={cn(styles.itemToken, isTokens ? styles.selected : '')}
              onClick={() => {
                routing.push(`/tokens`);
              }}
            >
              <Text>Assets</Text>
            </Box>

            <Box
              className={cn(styles.itemToken, isExplorer ? styles.selected : '')}
              onClick={() => {
                routing.push(`/explorer`);
              }}
            >
              <Text>Transactions</Text>
            </Box>

            <Box className={cn(styles.itemToken, isEarn ? styles.selected : '')} onClick={() => routing.push('/earn')}>
              <Text>Earn</Text>
            </Box>

            <Box
              className={cn(styles.itemToken, isSeFi ? styles.selected : '')}
              onClick={() => {
                routing.push(`/sefi`);
              }}
            >
              <Text>SeFi</Text>
            </Box>

            <Box
              className={cn(styles.itemToken, isSwap ? styles.selected : '')}
              onClick={() => {
                routing.push(`/swap`);
              }}
            >
              <Text>Swap</Text>
            </Box>

            <Box className={cn(styles.itemToken, isFaq ? styles.selected : '')} onClick={() => routing.push('/faq')}>
              <Text>FAQ</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }),
);
