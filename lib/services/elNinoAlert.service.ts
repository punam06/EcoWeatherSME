import { ElNinoAlert, SMEType } from '../types';

/**
 * Service to calculate Super El Niño risks and provide actionable precautions 
 * tailored for different SME sectors in Bangladesh.
 */

export function checkElNinoThreat(ensoIndex: number): Pick<ElNinoAlert, 'alertLevel'> {
  if (ensoIndex >= 2.0) {
    return { alertLevel: 'Emergency' }; // Super El Niño conditions
  } else if (ensoIndex >= 1.5) {
    return { alertLevel: 'Warning' }; // Strong El Niño
  } else if (ensoIndex >= 0.5) {
    return { alertLevel: 'Watch' }; // Developing El Niño
  } else {
    return { alertLevel: 'Normal' };
  }
}

export function generateSMEPrecautions(
  alertLevel: ElNinoAlert['alertLevel'],
  smeType: SMEType,
  region: string
): Pick<ElNinoAlert, 'expectedImpacts' | 'recommendedActions'> {
  let expectedImpacts: string[] = [];
  let recommendedActions: string[] = [];

  if (alertLevel === 'Normal') {
    return {
      expectedImpacts: ['Standard seasonal weather patterns expected.'],
      recommendedActions: ['Continue standard business operations.']
    };
  }

  // Define macro impacts based on region
  if (region.toLowerCase().includes('dhaka')) {
    expectedImpacts.push('Severe heatwaves and intense Urban Heat Island (UHI) effects.');
    expectedImpacts.push('High likelihood of commercial power load shedding.');
  } else if (region.toLowerCase().includes('khulna') || region.toLowerCase().includes('satkhira')) {
    expectedImpacts.push('Increased salinity intrusion into freshwater sources.');
    expectedImpacts.push('Extreme heat stress on local agriculture and fisheries.');
  } else {
    expectedImpacts.push('Widespread heatwaves and delayed monsoon rainfall.');
    expectedImpacts.push('Risk of sudden flash flooding towards the end of the season.');
  }

  // Tailor actions based on SME type and Alert Level
  if (smeType === 'Agro') {
    if (alertLevel === 'Emergency' || alertLevel === 'Warning') {
      recommendedActions.push('Immediate action: Secure evaporative cooling systems or shading nets for livestock.');
      recommendedActions.push('Begin strict rainwater harvesting as groundwater evaporation will spike.');
      recommendedActions.push('Consider micro-insurance for drought-related crop/livestock loss.');
    } else if (alertLevel === 'Watch') {
      recommendedActions.push('Monitor livestock for early signs of heat stress.');
      recommendedActions.push('Review supply of drought-resistant seeds and secure feed early.');
    }
  } else if (smeType === 'Retail') {
    if (alertLevel === 'Emergency' || alertLevel === 'Warning') {
      recommendedActions.push('Stockpile non-perishable raw materials; expect agricultural supply chain disruptions and price spikes.');
      recommendedActions.push('Diversify suppliers away from drought-prone northern regions.');
    } else if (alertLevel === 'Watch') {
      recommendedActions.push('Review inventory resilience against short-term supply shocks.');
    }
  } else if (smeType === 'Manufacturing') {
    if (alertLevel === 'Emergency' || alertLevel === 'Warning') {
      recommendedActions.push('Schedule heavy machinery operations during off-peak hours (e.g., late night) to avoid heat degradation.');
      recommendedActions.push('Service backup generators and secure fuel reserves ahead of expected grid failures.');
    } else if (alertLevel === 'Watch') {
      recommendedActions.push('Audit energy consumption and ensure machinery ventilation is adequate.');
    }
  }

  return { expectedImpacts, recommendedActions };
}

/**
 * Main entry point to get a comprehensive El Niño alert profile for an SME
 */
export function getElNinoAlertForSME(
  ensoIndex: number,
  smeType: SMEType,
  region: string
): ElNinoAlert {
  const threat = checkElNinoThreat(ensoIndex);
  const precautions = generateSMEPrecautions(threat.alertLevel, smeType, region);
  
  return {
    alertLevel: threat.alertLevel,
    ensoIndex,
    expectedImpacts: precautions.expectedImpacts,
    recommendedActions: precautions.recommendedActions
  };
}
