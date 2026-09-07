import type { LucideIcon } from 'lucide-react-native';
import { JobActivity } from './JobActivityCard';
import { PromoCode } from './PromoCodeCard';
import { RecommendedService } from './RecommendedCard';
import { TodoCardConfig } from './TodoCard';

export const jobActivities: JobActivity[] = [
  {
    id: 'job-1',
    title: 'Kitchen Sink Repair',
    category: 'Plumbing',
    submittedAt: '2 days ago',
    quotes: 3,
    priceRange: '$120 - $180',
    status: 'Completed'
  },
  {
    id: 'job-2',
    title: 'Kitchen Sink Repair',
    category: 'Plumbing',
    submittedAt: '2 days ago',
    quotes: 3,
    priceRange: '$120 - $180',
    status: 'Reviewing',
  }
];

export const recommendedServices: RecommendedService[] = [
  {
    id: 'rec-1',
    title: 'Painting',
    subtitle: 'Because you booked plumbing',
    image: require('../../assets/images/paintericon2.png'),
    categoryId: 'painter'
  },
  {
    id: 'rec-2',
    title: 'Plumbing',
    subtitle: 'Because you booked plumbing',
    image: require('../../assets/images/plumbericon2.png'),
    categoryId: 'plumber'
  },
  {
    id: 'rec-3',
    title: 'Painting',
    subtitle: 'Because you booked plumbing',
    image: require('../../assets/images/paintericon.png'),
    categoryId: 'painter'
  }
];

export const promoCodes: PromoCode[] = [
  {
    id: 'promo-1',
    code: 'WEEKEND15',
    description: '15% off weekend bookings'
  },
  {
    id: 'promo-2',
    code: 'FALL25',
    description: 'Save 25% on seasonal projects'
  }
];


export interface QuickAction {
  id: string;
  title: string;
  Icon: LucideIcon;
  color: string;
  backgroundColor: string;
  onPress?: () => void;
}
