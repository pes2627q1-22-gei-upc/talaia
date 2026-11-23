import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '@/core/theme/theme';
import { motion } from '@/core/theme/tokens';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useAuthViewModel } from './useAuthViewModel';

/** La sessió hi és però no s'ha pogut recuperar (p. ex. sense cobertura): es torna a provar. */
export function RestoreErrorScreen() {
  const styles = useStyles();
  const vm = useAuthViewModel();
  return (
    <SafeAreaView style={styles.root}>
      <Animated.View entering={FadeIn.duration(motion.base)}>
        <StateMessage
          title={vm.errorMessage ?? ''}
          action={{ label: vm.retryLabel, onPress: () => void vm.restore() }}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, justifyContent: 'center', backgroundColor: colors.nit },
}));
