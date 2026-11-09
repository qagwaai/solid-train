'use strict';

const source = require('../../data/kepler-11-historical-fit.json');

const EARTH_MASSES_PER_SOLAR_MASS = 332946.0487;

function buildHistoricalFitReport() {
  if (arguments.length) throw new Error('Historical fit adapter does not accept input overrides');
  const fit = structuredClone(source);
  const planets = fit.planets.map((planet) => {
    const parameters = Object.fromEntries(fit.columns.map((field, index) => {
      const [value, error] = planet.parameters[index];
      return [field, error === null
        ? { value, kind: 'fixed-model-parameter' }
        : { value, kind: 'fitted-parameter', errorUpper: error, errorLower: -error }];
    }));
    return {
      id: planet.id,
      parameters,
      diagnostics: {
        firstTransitJd: fit.timeOriginJd + parameters.transitOffsetDays.value,
        restFramePeriodDays: parameters.periodDays.value * fit.restFramePeriodFactor,
        massRatio: parameters.massRatioMicro.value * 1e-6,
        massEarth: parameters.massRatioMicro.value * 1e-6 *
          fit.host.massSolar.value * EARTH_MASSES_PER_SOLAR_MASS,
        eccentricity: Math.hypot(parameters.eCosOmega.value, parameters.eSinOmega.value),
        massKind: parameters.massRatioMicro.kind,
        eccentricityKind: parameters.eCosOmega.kind,
      },
    };
  });
  return {
    systemId: fit.systemId,
    fitId: fit.fitId,
    status: 'nominal-parameters-adapted',
    physicalEligibility: 'not-assessed',
    provenance: {
      reference: fit.reference,
      sourceUrl: fit.sourceUrl,
      reviewedAt: fit.reviewedAt,
      hostTable: fit.hostTable,
      planetTable: fit.planetTable,
    },
    conventions: {
      timeOriginJd: fit.timeOriginJd,
      dynamicalEpochJd: fit.timeOriginJd + fit.dynamicalEpochOffsetDays,
      sourcePeriods: 'Solar System barycentric observed periods',
      restFramePeriodFactor: fit.restFramePeriodFactor,
      transitOffsets: 'First transit after shared dynamical epoch; days from timeOriginJd',
      eccentricityComponents: 'Paired e*cos(omega), e*sin(omega) in published sky-angle convention',
      absoluteTimeScale: 'Not certified for state-vector conversion by this adapter',
      diagnosticUncertainties: 'Not propagated; source errors are marginal, not joint draws',
    },
    host: fit.host,
    planets,
    capabilities: {
      parameterReplay: true,
      stateVectors: false,
      integration: false,
      stabilityCertification: false,
      generation: false,
    },
    blockers: [
      'Joint covariance or posterior samples have not been recovered',
      'Time, coordinate and mutual-node conventions are not validated for state-vector conversion',
      'Nominal transit-timing or dynamical replay has not been performed',
      'Planet g mass and circular orbit are fixed fit assumptions, not measurements',
    ],
  };
}

module.exports = { buildHistoricalFitReport };
