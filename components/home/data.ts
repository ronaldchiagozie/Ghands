import { JobActivity } from './JobActivityCard';
import { PromoCode } from './PromoCodeCard';
import { RecommendedService } from './RecommendedCard';
import { TodoCardConfig } from './TodoCard';

export const todoItems: TodoCardConfig[] = [
  {
    id: 'todo-1',
    title: 'Complete Your Profile',
    iconName: 'person-outline'
  },
  {
    id: 'todo-2',
    title: 'Set Your Location',
    iconName: 'location-outline'
  },
  {
    id: 'todo-3',
    title: 'Add Payments Methods',
    iconName: 'card-outline'
  }
];

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
  iconName: string;
  color: string;
  backgroundColor: string;
  onPress?: () => void;
}
export const quickActions: QuickAction[] = [
  {
    id: 'emergency',
    title: 'Emergency Service',
    iconName: 'warning',
    color: '#A32126',
    backgroundColor: '#F8E8E8',
  },
  {
    id: 'book-again',
    title: 'Book Again',
    iconName: 'repeat',
    color: '#4F6739',
    backgroundColor: '#EEF5E8',
  },
  {
    id: 'wallet',
    title: 'My Wallet',
    iconName: 'wallet',
    color: '#8F5C12',
    backgroundColor: '#FAF4E8',
  },
];
