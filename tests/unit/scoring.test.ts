import { describe, expect, it } from 'vitest';
import { GameTimer, Streak, accuracy, pointsFor } from '../../src/lib/scoring';

describe('pointsFor', () => {
  it('gives 100 / 50 / 25 for first, second and third attempts', () => {
    expect(pointsFor({ attempt: 1, hintsUsed: 0, streak: 0 })).toBe(100);
    expect(pointsFor({ attempt: 2, hintsUsed: 0, streak: 0 })).toBe(50);
    expect(pointsFor({ attempt: 3, hintsUsed: 0, streak: 0 })).toBe(25);
  });

  it('adds a streak bonus of 10 per answer, capped at 50, only on first attempts', () => {
    expect(pointsFor({ attempt: 1, hintsUsed: 0, streak: 2 })).toBe(120);
    expect(pointsFor({ attempt: 1, hintsUsed: 0, streak: 12 })).toBe(150);
    expect(pointsFor({ attempt: 2, hintsUsed: 0, streak: 4 })).toBe(50);
  });

  it('removes 40% per hint but never goes below 10', () => {
    expect(pointsFor({ attempt: 1, hintsUsed: 1, streak: 0 })).toBe(60);
    expect(pointsFor({ attempt: 1, hintsUsed: 2, streak: 0 })).toBe(20);
    expect(pointsFor({ attempt: 1, hintsUsed: 3, streak: 0 })).toBe(10);
  });

  it('adds 5 points per whole second left on the countdown', () => {
    expect(pointsFor({ attempt: 1, hintsUsed: 0, streak: 0, secondsLeft: 7.9 })).toBe(135);
  });
});

describe('Streak', () => {
  it('counts consecutive hits, tracks the best run and resets on a miss', () => {
    const s = new Streak();
    s.hit();
    s.hit();
    s.hit();
    expect(s.current).toBe(3);
    s.miss();
    expect(s.current).toBe(0);
    s.hit();
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
});

describe('accuracy', () => {
  it('is the rounded share of first-try answers', () => {
    expect(accuracy(7, 10)).toBe(70);
    expect(accuracy(2, 3)).toBe(67);
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe('GameTimer', () => {
  const fakeClock = () => {
    let now = 0;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  };

  it('counts elapsed time and excludes paused time', () => {
    const clock = fakeClock();
    const timer = new GameTimer(0, clock.now);
    timer.start();
    clock.advance(1500);
    expect(timer.elapsedMs()).toBe(1500);
    timer.pause();
    clock.advance(10_000);
    expect(timer.elapsedMs()).toBe(1500);
    timer.start();
    clock.advance(500);
    expect(timer.elapsedMs()).toBe(2000);
  });

  it('has no countdown when secondsPerQuestion is 0', () => {
    const timer = new GameTimer(0, fakeClock().now);
    expect(timer.secondsLeft()).toBeNull();
    expect(timer.isExpired()).toBe(false);
  });

  it('runs a per-question countdown that restarts on each question', () => {
    const clock = fakeClock();
    const timer = new GameTimer(12, clock.now);
    timer.start();
    timer.startQuestion();
    clock.advance(5000);
    expect(timer.secondsLeft()).toBe(7);
    clock.advance(7000);
    expect(timer.isExpired()).toBe(true);
    expect(timer.secondsLeft()).toBe(0);
    timer.startQuestion();
    expect(timer.secondsLeft()).toBe(12);
    expect(timer.isExpired()).toBe(false);
  });

  it('freezes the countdown while paused', () => {
    const clock = fakeClock();
    const timer = new GameTimer(10, clock.now);
    timer.start();
    timer.startQuestion();
    clock.advance(3000);
    timer.pause();
    clock.advance(60_000);
    expect(timer.secondsLeft()).toBe(7);
  });
});
