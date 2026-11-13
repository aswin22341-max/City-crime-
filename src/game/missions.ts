import type { MissionDef } from './types';

export const STORY_MISSIONS: MissionDef[] = [
  {
    id: 'mission_1_first_drive',
    number: 1,
    title: 'First Drive',
    subtitle: 'Acquire wheels and hit the skyline',
    description:
      'Locate the Vortex GT Sports Car at the Apex Dealership, climb inside, and drive to the Downtown Skyline Plaza.',
    rewardMoney: 1500,
    startPos: { x: -16, y: 0, z: 70 },
  },
  {
    id: 'mission_2_city_delivery',
    number: 2,
    title: 'City Delivery',
    subtitle: 'Beat the clock across town',
    description:
      'Pick up the priority courier briefcase at Metro Shopping Mall and deliver it to the International Airport Terminal before the timer runs out.',
    rewardMoney: 3000,
    startPos: { x: -30, y: 0, z: 12 },
    timeLimitSec: 95,
  },
  {
    id: 'mission_3_police_chase',
    number: 3,
    title: 'Police Chase',
    subtitle: 'Lose the heat and reach cover',
    description:
      'A citywide alert has triggered a 3-Star pursuit! Outrun the LCPD Interceptors and reach the Industrial Docks Safehouse.',
    rewardMoney: 4500,
    startPos: { x: -90, y: 0, z: 12 },
  },
  {
    id: 'mission_4_street_race',
    number: 4,
    title: 'Street Race',
    subtitle: 'Midnight circuit against rivals',
    description:
      'Compete against 3 AI street racers across a 5-checkpoint downtown & coastal highway circuit. Cross the finish line first!',
    rewardMoney: 6000,
    startPos: { x: 60, y: 0, z: 120 },
  },
  {
    id: 'mission_5_city_exploration',
    number: 5,
    title: 'City Exploration',
    subtitle: 'Tour the city landmarks',
    description:
      'Visit key landmarks across the city: Underground Parking, Sunset Beach Pier, North Peak Overlook, and Central Park.',
    rewardMoney: 8000,
    startPos: { x: 30, y: 0, z: 12 },
  },
];

export const RACE_CHECKPOINTS: Array<{ x: number; y: number; z: number }> = [
  { x: 60, y: 0, z: 0 },
  { x: 60, y: 0, z: -120 },
  { x: 180, y: 0, z: -120 },
  { x: 180, y: 0, z: 60 },
  { x: 120, y: 0, z: 180 },
  { x: 60, y: 0, z: 120 },
];

export const EXPLORE_TARGETS: Array<{ name: string; x: number; y: number; z: number }> = [
  { name: 'Underground Parking P1', x: 96, y: -4.2, z: 90 },
  { name: 'Sunset Beach Pier', x: 252, y: 1.05, z: 90 },
  { name: 'North Peak Overlook', x: -206, y: 10.8, z: -204 },
  { name: 'Central Fountain Park', x: 30, y: 0, z: 12 },
];
