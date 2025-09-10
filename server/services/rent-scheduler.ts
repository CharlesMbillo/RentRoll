/**
 * Rent Collection Scheduler
 * Handles automated monthly rent collection on the 1st of each month at 9 AM
 */

import { getBatchPaymentProcessor } from './batch-payment-processor';

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  hour: number; // 0-23
  dayOfMonth: number; // 1-31
  testMode: boolean;
}

export class RentScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig;

  constructor(config: SchedulerConfig = {
    enabled: true,
    timezone: 'Africa/Nairobi',
    hour: 9, // 9 AM
    dayOfMonth: 1, // 1st of month
    testMode: false
  }) {
    this.config = config;
  }

  /**
   * Start the scheduler - checks every hour for the right time to trigger
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ Rent scheduler is already running');
      return;
    }

    console.log(`⏰ Starting rent scheduler: ${this.config.dayOfMonth}st of each month at ${this.config.hour}:00 ${this.config.timezone}`);
    
    this.isRunning = true;
    
    // Check every hour (3600000 ms) if it's time to run
    this.intervalId = setInterval(() => {
      this.checkAndTriggerRentCollection();
    }, 3600000); // 1 hour intervals

    // Also check immediately on start
    this.checkAndTriggerRentCollection();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏰ Rent scheduler stopped');
  }

  /**
   * Check if it's time to trigger rent collection and do it
   */
  private async checkAndTriggerRentCollection() {
    if (!this.config.enabled) {
      return;
    }

    const now = new Date();
    const nairobiTime = new Date(now.toLocaleString('en-US', { timeZone: this.config.timezone }));
    
    // Check if it's the right day and hour
    const isRightDay = nairobiTime.getDate() === this.config.dayOfMonth;
    const isRightHour = nairobiTime.getHours() === this.config.hour;
    
    if (isRightDay && isRightHour) {
      const currentMonth = nairobiTime.toISOString().slice(0, 7); // YYYY-MM format
      
      console.log(`🚨 SCHEDULED RENT COLLECTION TRIGGERED for ${currentMonth} at ${nairobiTime.toISOString()}`);
      
      try {
        await this.triggerMonthlyRentCollection(currentMonth);
      } catch (error: any) {
        console.error('❌ Scheduled rent collection failed:', error);
        // TODO: Send alert to admin/landlord about failure
      }
    }
  }

  /**
   * Manually trigger rent collection for a specific month
   */
  async triggerMonthlyRentCollection(month?: string): Promise<void> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    console.log(`🏠 Manually triggering rent collection for ${targetMonth}`);
    
    const processor = getBatchPaymentProcessor();
    
    // Set due date to the 1st of the target month
    const [year, monthNum] = targetMonth.split('-');
    const dueDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    
    const result = await processor.processMonthlyRentCollection({
      month: targetMonth,
      dueDate,
      testMode: this.config.testMode,
    });

    console.log(`✅ Rent collection completed for ${targetMonth}:`, {
      batchId: result.batchId,
      totalTenants: result.totalTenants,
      successful: result.successfulPayments,
      failed: result.failedPayments,
      totalAmount: result.totalAmount
    });

    // TODO: Send notification to landlord/caretaker with results
    return;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextCheck: this.getNextCheckTime(),
    };
  }

  /**
   * Calculate when the next rent collection will happen
   */
  private getNextCheckTime(): Date {
    const now = new Date();
    const nairobiTime = new Date(now.toLocaleString('en-US', { timeZone: this.config.timezone }));
    
    // Calculate next 1st of month at 9 AM
    const nextMonth = new Date(nairobiTime.getFullYear(), nairobiTime.getMonth() + 1, this.config.dayOfMonth, this.config.hour, 0, 0);
    
    return nextMonth;
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⏰ Scheduler config updated:', this.config);
    
    // Restart if running to apply new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Singleton instance
let scheduler: RentScheduler | null = null;

/**
 * Get the global rent scheduler instance
 */
export function getRentScheduler(): RentScheduler {
  if (!scheduler) {
    scheduler = new RentScheduler();
  }
  return scheduler;
}

/**
 * Initialize and start the rent scheduler
 */
export function initializeRentScheduler(config?: Partial<SchedulerConfig>) {
  const rentScheduler = getRentScheduler();
  
  if (config) {
    rentScheduler.updateConfig(config);
  }
  
  rentScheduler.start();
  return rentScheduler;
}