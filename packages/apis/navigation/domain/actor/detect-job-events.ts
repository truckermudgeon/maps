import { assertExists } from '@truckermudgeon/base/assert';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { CompanyItem } from '@truckermudgeon/map/types';
import { EventEmitter } from 'events';
import type { JobLocation, JobState } from '../../types';
import type { TelemetryEventEmitter } from '../session-actor';

export type JobEventEmitter = EventEmitter<{
  /**
   * Emitted when a job's destination changes, e.g., when a job starts or ends
   * for any reason.
   */
  update: [JobState | undefined];
}>;

export function detectJobEvents(opts: {
  telemetryEventEmitter: TelemetryEventEmitter;
  jobMappedData: MappedDataForKeys<['companies', 'cities', 'countries']>;
}): {
  readJobState: () => JobState | undefined;
  jobEventEmitter: JobEventEmitter;
} {
  const { telemetryEventEmitter, jobMappedData } = opts;
  const jobEventEmitter: JobEventEmitter = new EventEmitter();

  let jobState: JobState | undefined;
  const readJobState = () => jobState;
  const companiesByKey = new Map<string, CompanyItem>(
    jobMappedData.companies.values().map(c => [`${c.token}.${c.cityToken}`, c]),
  );

  telemetryEventEmitter.on('telemetry', function detectJobEvents(telemetry) {
    const curDestKey = toKey(jobState?.destination);
    const newDestKey = toKey(telemetry.job.destination);
    if (curDestKey === newDestKey) {
      return;
    }

    if (newDestKey == null) {
      jobState = undefined;
    } else if (!companiesByKey.has(newDestKey)) {
      // the job is either a special transport route (unsupported)
      // or the job is for some company in some mod (also unsupported).
      // ignore for now.
      jobState = undefined;
    } else {
      const company = assertExists(
        companiesByKey.get(newDestKey),
        `unknown company key ${newDestKey}`,
      );
      const city = assertExists(
        jobMappedData.cities.get(company.cityToken),
        `unknown city token ${company.cityToken} for company ${company.token}`,
      );
      if (!jobMappedData.countries.has(city.countryToken)) {
        // unknown country (e.g., because of mod, or unknown DLC).
        // ignore for now.
        // TODO log unknown country?
        jobState = undefined;
      } else {
        const country = assertExists(
          jobMappedData.countries.get(city.countryToken),
          `unknown country token ${city.countryToken}`,
        );

        jobState = {
          ...telemetry.job,
          toNodeUid: company.nodeUid.toString(16),
          countryCode: country.code,
          countryName: country.name,
        };
      }
    }

    jobEventEmitter.emit('update', jobState);
  });

  return {
    readJobState,
    jobEventEmitter,
  };
}

function toKey(location: JobLocation | undefined): string | undefined {
  if (location == null) {
    return undefined;
  }
  return location.city.id !== ''
    ? `${location.company.id}.${location.city.id}`
    : undefined;
}
