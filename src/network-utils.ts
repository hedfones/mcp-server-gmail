/**
 * Network utilities for IPv6 dual-stack support
 */

import { createServer } from 'http';
import { NetworkConfig } from './config.js';

export interface NetworkStackInfo {
  ipv4Available: boolean;
  ipv6Available: boolean;
  preferredStack: 'ipv4' | 'ipv6' | 'dual';
}

export interface BindResult {
  success: boolean;
  address: string;
  port: number;
  family: 'IPv4' | 'IPv6';
  server?: any;
  error?: Error;
}

/**
 * Detects available network stacks (IPv4/IPv6) on the system
 */
export async function detectNetworkStack(): Promise<NetworkStackInfo> {
  const ipv4Available = await testNetworkBinding('0.0.0.0', 0);
  const ipv6Available = await testNetworkBinding('::', 0);
  
  let preferredStack: 'ipv4' | 'ipv6' | 'dual' = 'ipv4';
  
  if (ipv4Available && ipv6Available) {
    preferredStack = 'dual';
  } else if (ipv6Available) {
    preferredStack = 'ipv6';
  } else if (ipv4Available) {
    preferredStack = 'ipv4';
  }
  
  return {
    ipv4Available,
    ipv6Available,
    preferredStack
  };
}

/**
 * Tests if we can bind to a specific address and port
 */
async function testNetworkBinding(address: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const testServer = createServer();
    
    testServer.on('error', () => {
      resolve(false);
    });
    
    testServer.listen(port, address, () => {
      testServer.close(() => {
        resolve(true);
      });
    });
    
    // Timeout after 1 second
    setTimeout(() => {
      testServer.close(() => {
        resolve(false);
      });
    }, 1000);
  });
}

/**
 * Attempts to bind to the optimal network configuration
 */
export async function bindToOptimalNetwork(
  networkConfig: NetworkConfig,
  createServerFn: () => any
): Promise<BindResult> {
  const stackInfo = await detectNetworkStack();
  
  console.log('Network stack detection:', {
    ipv4Available: stackInfo.ipv4Available,
    ipv6Available: stackInfo.ipv6Available,
    preferredStack: stackInfo.preferredStack,
    requestedDualStack: networkConfig.dualStack,
    preferIPv6: networkConfig.preferIPv6
  });
  
  // Determine binding strategy based on configuration and availability
  const bindingStrategy = determineBindingStrategy(networkConfig, stackInfo);
  
  console.log('Selected binding strategy:', bindingStrategy);
  
  // Attempt binding with the selected strategy
  return await attemptBinding(bindingStrategy, networkConfig, createServerFn);
}

/**
 * Determines the optimal binding strategy based on config and network availability
 */
function determineBindingStrategy(
  networkConfig: NetworkConfig,
  stackInfo: NetworkStackInfo
): 'ipv6-dual' | 'ipv4-only' | 'ipv6-only' {
  // If dual-stack is requested and IPv6 is available, try IPv6 dual-stack first
  if (networkConfig.dualStack && stackInfo.ipv6Available) {
    return 'ipv6-dual';
  }
  
  // If IPv6 is preferred and available
  if (networkConfig.preferIPv6 && stackInfo.ipv6Available) {
    return 'ipv6-only';
  }
  
  // If only IPv6 is available
  if (stackInfo.ipv6Available && !stackInfo.ipv4Available) {
    return 'ipv6-only';
  }
  
  // Default to IPv4 if available
  if (stackInfo.ipv4Available) {
    return 'ipv4-only';
  }
  
  // Fallback to IPv6 if it's the only option
  return 'ipv6-only';
}

/**
 * Attempts to bind using the specified strategy with graceful fallback
 */
async function attemptBinding(
  strategy: 'ipv6-dual' | 'ipv4-only' | 'ipv6-only',
  networkConfig: NetworkConfig,
  createServerFn: () => any
): Promise<BindResult> {
  console.log(`Attempting to bind using strategy: ${strategy}`);
  
  switch (strategy) {
    case 'ipv6-dual':
      return await attemptBindingWithFallback(networkConfig, createServerFn);
    
    case 'ipv6-only':
      return await tryBindWithLogging(createServerFn(), '::', networkConfig.port, 'IPv6');
    
    case 'ipv4-only':
      return await tryBindWithLogging(createServerFn(), '0.0.0.0', networkConfig.port, 'IPv4');
    
    default:
      throw new Error(`Unknown binding strategy: ${strategy}`);
  }
}

/**
 * Attempts IPv6 dual-stack binding with automatic fallback to IPv4
 */
async function attemptBindingWithFallback(
  networkConfig: NetworkConfig,
  createServerFn: () => any
): Promise<BindResult> {
  console.log('Attempting IPv6 dual-stack binding with fallback...');
  
  // First, try IPv6 dual-stack
  let result = await tryBindWithLogging(createServerFn(), '::', networkConfig.port, 'IPv6');
  
  if (result.success) {
    console.log('✓ IPv6 dual-stack binding successful');
    return result;
  }
  
  console.warn('✗ IPv6 dual-stack binding failed:', result.error?.message);
  console.log('Attempting fallback to IPv4-only...');
  
  // Fallback to IPv4-only
  result = await tryBindWithLogging(createServerFn(), '0.0.0.0', networkConfig.port, 'IPv4');
  
  if (result.success) {
    console.log('✓ IPv4-only fallback successful');
    return result;
  }
  
  console.error('✗ IPv4-only fallback also failed:', result.error?.message);
  
  // If both fail, try binding to localhost as last resort
  console.log('Attempting final fallback to localhost...');
  result = await tryBindWithLogging(createServerFn(), '127.0.0.1', networkConfig.port, 'IPv4');
  
  if (result.success) {
    console.log('✓ Localhost fallback successful');
  } else {
    console.error('✗ All binding attempts failed');
  }
  
  return result;
}

/**
 * Wrapper around tryBind with enhanced logging
 */
async function tryBindWithLogging(
  server: any,
  address: string,
  port: number,
  family: 'IPv4' | 'IPv6'
): Promise<BindResult> {
  console.log(`Trying to bind to ${address}:${port} (${family})`);
  
  const result = await tryBind(server, address, port, family);
  
  if (result.success) {
    console.log(`✓ Successfully bound to ${result.address}:${result.port} (${result.family})`);
  } else {
    console.warn(`✗ Failed to bind to ${address}:${port} (${family}):`, result.error?.message);
  }
  
  return result;
}

/**
 * Attempts to bind to a specific address and port
 */
async function tryBind(
  server: any,
  address: string,
  port: number,
  family: 'IPv4' | 'IPv6'
): Promise<BindResult> {
  return new Promise((resolve) => {
    const onError = (error: Error) => {
      resolve({
        success: false,
        address,
        port,
        family,
        error
      });
    };
    
    const onListening = () => {
      const actualAddress = server.address();
      resolve({
        success: true,
        address: actualAddress?.address || address,
        port: actualAddress?.port || port,
        family,
        server
      });
    };
    
    server.once('error', onError);
    server.once('listening', onListening);
    
    try {
      // For IPv6 dual-stack, we need to set the ipv6Only option to false
      if (family === 'IPv6' && address === '::') {
        server.listen(port, address, () => {
          // Try to enable dual-stack by setting ipv6Only to false
          try {
            if (server._handle && server._handle.setIPv6Only) {
              server._handle.setIPv6Only(false);
            }
          } catch (err) {
            console.warn('Could not enable IPv6 dual-stack mode:', err.message);
          }
        });
      } else {
        server.listen(port, address);
      }
    } catch (error) {
      onError(error as Error);
    }
  });
}

/**
 * Creates a network configuration with IPv6 dual-stack support
 */
export function createDualStackNetworkConfig(
  port: number,
  preferIPv6: boolean = true,
  enableDualStack: boolean = true
): NetworkConfig {
  return {
    preferIPv6,
    dualStack: enableDualStack,
    bindAddress: preferIPv6 ? '::' : '0.0.0.0',
    port
  };
}

/**
 * Logs network configuration decisions for debugging
 */
export function logNetworkConfiguration(
  bindResult: BindResult,
  networkConfig: NetworkConfig,
  stackInfo: NetworkStackInfo
): void {
  console.log('=== Network Configuration Summary ===');
  console.log('Requested configuration:', {
    preferIPv6: networkConfig.preferIPv6,
    dualStack: networkConfig.dualStack,
    bindAddress: networkConfig.bindAddress,
    port: networkConfig.port
  });
  
  console.log('System capabilities:', {
    ipv4Available: stackInfo.ipv4Available,
    ipv6Available: stackInfo.ipv6Available,
    preferredStack: stackInfo.preferredStack
  });
  
  console.log('Binding result:', {
    success: bindResult.success,
    actualAddress: bindResult.address,
    actualPort: bindResult.port,
    family: bindResult.family,
    error: bindResult.error?.message
  });
  
  if (bindResult.success) {
    const dualStackEnabled = bindResult.family === 'IPv6' && bindResult.address === '::';
    console.log('Network mode:', dualStackEnabled ? 'IPv6 dual-stack' : `${bindResult.family} only`);
  }
  
  console.log('=====================================');
}
/**

 * Provides network configuration recommendations based on system capabilities
 */
export function getNetworkRecommendations(stackInfo: NetworkStackInfo): string[] {
  const recommendations: string[] = [];
  
  if (!stackInfo.ipv4Available && !stackInfo.ipv6Available) {
    recommendations.push('No network stacks appear to be available. Check system network configuration.');
    recommendations.push('Ensure the application has permission to bind to network interfaces.');
  } else if (!stackInfo.ipv6Available) {
    recommendations.push('IPv6 is not available on this system.');
    recommendations.push('Consider setting ENABLE_IPV6=false to disable IPv6 attempts.');
    recommendations.push('The server will automatically fall back to IPv4-only mode.');
  } else if (!stackInfo.ipv4Available) {
    recommendations.push('IPv4 is not available on this system.');
    recommendations.push('The server will use IPv6-only mode.');
    recommendations.push('Ensure clients can connect via IPv6.');
  } else {
    recommendations.push('Both IPv4 and IPv6 are available.');
    recommendations.push('Consider enabling dual-stack mode for maximum compatibility.');
  }
  
  return recommendations;
}

/**
 * Handles network binding errors with detailed diagnostics
 */
export function handleNetworkBindingError(
  error: Error,
  networkConfig: NetworkConfig,
  stackInfo: NetworkStackInfo
): Error {
  const recommendations = getNetworkRecommendations(stackInfo);
  
  let errorMessage = `Network binding failed: ${error.message}\n\n`;
  errorMessage += 'Configuration:\n';
  errorMessage += `  - Preferred IPv6: ${networkConfig.preferIPv6}\n`;
  errorMessage += `  - Dual-stack: ${networkConfig.dualStack}\n`;
  errorMessage += `  - Bind address: ${networkConfig.bindAddress}\n`;
  errorMessage += `  - Port: ${networkConfig.port}\n\n`;
  
  errorMessage += 'System capabilities:\n';
  errorMessage += `  - IPv4 available: ${stackInfo.ipv4Available}\n`;
  errorMessage += `  - IPv6 available: ${stackInfo.ipv6Available}\n`;
  errorMessage += `  - Preferred stack: ${stackInfo.preferredStack}\n\n`;
  
  errorMessage += 'Recommendations:\n';
  recommendations.forEach((rec, index) => {
    errorMessage += `  ${index + 1}. ${rec}\n`;
  });
  
  return new Error(errorMessage);
}