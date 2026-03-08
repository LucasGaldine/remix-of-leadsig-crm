import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useDaysOff } from '@/hooks/useDaysOff';
import { useAuth } from '@/hooks/useAuth';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function SettingsAvailability() {
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const { businessHours, upsertBusinessHours } = useBusinessHours();
  const { daysOff, addDayOff, updateDayOff, deleteDayOff } = useDaysOff();
  const { settings, updateSettings, isSaving: isSavingSettings } = useAccountSettings();

  const [newDayOff, setNewDayOff] = useState({ date: '', reason: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState<string>('');

  useEffect(() => {
    if (settings && settings.daily_job_limit != null) {
      setMaxJobsPerDay(String(settings.daily_job_limit));
    } else {
      setMaxJobsPerDay('');
    }
  }, [settings]);

  const getBusinessHoursForDay = (dayOfWeek: number) => {
    return businessHours?.find((bh) => bh.day_of_week === dayOfWeek) || null;
  };

  const handleBusinessHoursChange = (
    dayOfWeek: number,
    field: 'start_time' | 'end_time' | 'is_closed',
    value: string | boolean
  ) => {
    if (!currentAccount?.id) return;

    const existing = getBusinessHoursForDay(dayOfWeek);
    const isClosed = field === 'is_closed' ? (value as boolean) : existing?.is_closed || false;

    upsertBusinessHours({
      account_id: currentAccount.id,
      day_of_week: dayOfWeek,
      start_time: isClosed ? null : field === 'start_time' ? (value as string) : existing?.start_time || '09:00',
      end_time: isClosed ? null : field === 'end_time' ? (value as string) : existing?.end_time || '17:00',
      is_closed: isClosed,
    });
  };

  const handleAddDayOff = () => {
    if (!currentAccount?.id || !newDayOff.date) return;

    addDayOff({
      account_id: currentAccount.id,
      date: newDayOff.date,
      reason: newDayOff.reason || undefined,
    });

    setNewDayOff({ date: '', reason: '' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Availability Settings"
        subtitle="Manage your business hours and days off"
        showBack
        backTo="/settings"
      />
      <div className="container max-w-4xl mx-auto p-6 space-y-6">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Daily Job Limit
            </CardTitle>
            <CardDescription>
              Set the maximum number of jobs you can accept per day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="max-jobs">Maximum Jobs Per Day</Label>
                <Input
                  id="max-jobs"
                  type="number"
                  min="1"
                  placeholder="Enter maximum number"
                  value={maxJobsPerDay}
                  onChange={(e) => setMaxJobsPerDay(e.target.value)}
                  className="mt-2"
                />
              </div>
              <Button
                onClick={() => {
                  if (!currentAccount?.id) return;
                  if (maxJobsPerDay.trim() === '') {
                    toast.error('Please enter a number before saving');
                    return;
                  }

                  const parsed = Number(maxJobsPerDay);
                  if (Number.isNaN(parsed) || parsed < 1) {
                    toast.error('Daily job limit must be at least 1');
                    return;
                  }

                  updateSettings({ daily_job_limit: parsed });
                }}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Regular Business Hours
            </CardTitle>
            <CardDescription>
              Set your typical working hours for each day of the week. Jobs can be scheduled
              outside these hours, but will be marked as outside normal business hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map((day) => {
              const hours = getBusinessHoursForDay(day.value);
              const isClosed = hours?.is_closed || false;

              return (
                <div
                  key={day.value}
                  className="flex items-center gap-4 p-4 border rounded-lg bg-white dark:bg-slate-800"
                >
                  <div className="w-32">
                    <Label className="font-medium">{day.label}</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!isClosed}
                      onCheckedChange={(checked) =>
                        handleBusinessHoursChange(day.value, 'is_closed', !checked)
                      }
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {isClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  {!isClosed && (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={hours?.start_time || '09:00'}
                          onChange={(e) =>
                            handleBusinessHoursChange(day.value, 'start_time', e.target.value)
                          }
                          className="w-32"
                        />
                        <span className="text-slate-600 dark:text-slate-400">to</span>
                        <Input
                          type="time"
                          value={hours?.end_time || '17:00'}
                          onChange={(e) =>
                            handleBusinessHoursChange(day.value, 'end_time', e.target.value)
                          }
                          className="w-32"
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Days Off & Holidays
            </CardTitle>
            <CardDescription>
              Block specific dates when you won't be accepting jobs. Jobs cannot be scheduled on
              these dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="day-off-date">Date</Label>
                <Input
                  id="day-off-date"
                  type="date"
                  value={newDayOff.date}
                  onChange={(e) => setNewDayOff({ ...newDayOff, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="day-off-reason">Reason (optional)</Label>
                <Input
                  id="day-off-reason"
                  placeholder="e.g., Christmas, Vacation"
                  value={newDayOff.reason}
                  onChange={(e) => setNewDayOff({ ...newDayOff, reason: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddDayOff} disabled={!newDayOff.date}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {daysOff && daysOff.length > 0 ? (
              <div className="space-y-2">
                <Label>Scheduled Days Off</Label>
                <div className="space-y-2">
                  {daysOff.map((dayOff) => (
                    <div
                      key={dayOff.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-slate-800"
                    >
                      <div>
                        <div className="font-medium">{formatDate(dayOff.date)}</div>
                        {dayOff.reason && (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {dayOff.reason}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(dayOff.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                No days off scheduled
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Day Off</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this day off? This will allow jobs to be scheduled on
              this date again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteDayOff(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MobileNav />
    </div>
  );
}
