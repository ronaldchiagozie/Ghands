import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Allow className on SafeAreaView - required for SafeAreaWrapper + NativeWind v4. */
cssInterop(SafeAreaView, { className: 'style' });
