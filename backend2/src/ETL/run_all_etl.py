#!/usr/bin/env python3
"""
SP500 Dashboard ETL Runner
Daily data gathering script that runs all ETL fetchers separately.

This script executes all data fetchers in sequence to gather financial data
from various sources (FRED, Yahoo Finance, etc.) and stores it in MongoDB.

Usage:
    python run_all_etl.py [--dry-run] [--parallel] [--skip-errors]

Options:
    --dry-run      Show what would be executed without actually running
    --parallel     Run compatible fetchers in parallel (experimental)
    --skip-errors  Continue running other fetchers if one fails
"""

import os
import sys
import subprocess
import logging
import argparse
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Tuple
import json

# Import ETL common configuration
from etl_config import setup_etl_environment, get_session_info

# Add the parent directory to the path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

class ETLRunner:
    """Main ETL Runner class to execute all data fetchers."""
    
    def __init__(self, dry_run: bool = False, skip_errors: bool = False):
        """Initialize ETL Runner."""
        self.dry_run = dry_run
        self.skip_errors = skip_errors
        self.current_dir = current_dir
        self.results = {}
        
        # Setup environment using common configuration
        self.logger, self.db = setup_etl_environment('run_all_etl')
        
        # Set up logging file
        self.log_file = os.path.join(self.current_dir, f'etl_runner_{datetime.now().strftime("%Y%m%d")}.log')
        
        # Get yfinance session info
        self.session_info = get_session_info()
        
        # Define ETL scripts with their priorities and descriptions
        self.etl_scripts = [
            {
                'name': 'Monetary Policy Fetcher',
                'script': 'monetary_policy_fetcher.py',
                'description': 'Fetches Federal Reserve monetary policy data (DFF, WALCL, SOFR, etc.)',
                'priority': 1,
                'estimated_time': '30-60 seconds',
                'dependencies': ['FRED API'],
                'data_sources': ['Federal Reserve Economic Data (FRED)']
            },
            {
                'name': 'Macro Economics Fetcher',
                'script': 'macro_economics_fetcher.py',
                'description': 'Fetches macroeconomic indicators (GDP, unemployment, inflation, etc.)',
                'priority': 2,
                'estimated_time': '45-90 seconds',
                'dependencies': ['FRED API'],
                'data_sources': ['Federal Reserve Economic Data (FRED)', 'Bureau of Labor Statistics']
            },
            {
                'name': 'System Risk Fetcher',
                'script': 'system_risk_fetcher.py',
                'description': 'Fetches systemic risk indicators (VIX, credit spreads, yield curves)',
                'priority': 3,
                'estimated_time': '60-120 seconds',
                'dependencies': ['FRED API', 'Yahoo Finance'],
                'data_sources': ['FRED', 'Yahoo Finance', 'CBOE']
            },
            {
                'name': 'Valuation Fetcher',
                'script': 'valuation_fetcher.py',
                'description': 'Fetches market valuation metrics (P/E ratios, P/B ratios, dividend yields)',
                'priority': 4,
                'estimated_time': '90-180 seconds',
                'dependencies': ['Yahoo Finance'],
                'data_sources': ['Yahoo Finance', 'S&P 500 companies']
            },
            {
                'name': 'Corporate Earnings Fetcher',
                'script': 'corporate_earnings_fetcher_v3.py',
                'description': 'Fetches corporate earnings data (EPS, revenue, margins, ROA)',
                'priority': 5,
                'estimated_time': '120-240 seconds',
                'dependencies': ['Yahoo Finance'],
                'data_sources': ['Yahoo Finance', 'Major S&P 500 companies']
            },
            {
                'name': 'Sector Performance Fetcher',
                'script': 'sector_performance_fetcher.py',
                'description': 'Fetches sector performance and rotation signals',
                'priority': 6,
                'estimated_time': '90-180 seconds',
                'dependencies': ['Yahoo Finance'],
                'data_sources': ['Yahoo Finance', 'Sector ETFs']
            },
            {
                'name': 'Liquidity Flows Fetcher',
                'script': 'liquidity_flows_fetcher.py',
                'description': 'Fetches liquidity and money supply data',
                'priority': 7,
                'estimated_time': '60-120 seconds',
                'dependencies': ['FRED API', 'Yahoo Finance'],
                'data_sources': ['Federal Reserve', 'ETF flows data']
            }
        ]
        
        # Verify scripts exist
        self.available_scripts = []
        for script_info in self.etl_scripts:
            script_path = os.path.join(self.current_dir, script_info['script'])
            if os.path.exists(script_path):
                self.available_scripts.append(script_info)
            else:
                self.self.logger.warning(f"Script not found: {script_info['script']}")
    
    def print_banner(self):
        """Print startup banner."""
        print("\n" + "="*80)
        print("🚀 SP500 Dashboard ETL Runner")
        print("📊 Daily Financial Data Gathering System")
        print("="*80)
        print(f"📅 Run Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 Working Directory: {self.current_dir}")
        print(f"📝 Log File: {self.log_file}")
        print(f"🔧 Mode: {'DRY RUN' if self.dry_run else 'LIVE EXECUTION'}")
        print(f"⚙️ Error Handling: {'SKIP ON ERROR' if self.skip_errors else 'STOP ON ERROR'}")
        print(f"📜 Available Scripts: {len(self.available_scripts)}")
        print(f"🌐 yfinance Session: {self.session_info['session_type']}")
        print("="*80 + "\n")
    
    def print_script_summary(self):
        """Print summary of scripts to be executed."""
        print("📋 EXECUTION PLAN:")
        print("-" * 50)
        
        total_time_min = 0
        total_time_max = 0
        
        for i, script in enumerate(self.available_scripts, 1):
            time_parts = script['estimated_time'].split('-')
            min_time = int(time_parts[0])
            max_time = int(time_parts[1].split()[0])
            total_time_min += min_time
            total_time_max += max_time
            
            print(f"{i:2d}. {script['name']}")
            print(f"    📄 Script: {script['script']}")
            print(f"    📝 Description: {script['description']}")
            print(f"    ⏱️  Estimated Time: {script['estimated_time']}")
            print(f"    🔗 Data Sources: {', '.join(script['data_sources'])}")
            print()
        
        print(f"⏱️  Total Estimated Time: {total_time_min//60}-{total_time_max//60} minutes")
        print("-" * 50 + "\n")
    
    def run_script(self, script_info: Dict) -> Tuple[bool, str, float]:
        """Run a single ETL script."""
        script_name = script_info['name']
        script_file = script_info['script']
        
        self.logger.info(f"Starting {script_name}...")
        print(f"🔄 Running: {script_name}")
        print(f"   Script: {script_file}")
        
        if self.dry_run:
            print(f"   [DRY RUN] Would execute: python {script_file}")
            return True, "Dry run completed", 0.1
        
        start_time = time.time()
        
        try:
            # Change to ETL directory and run the script
            result = subprocess.run(
                [sys.executable, script_file],
                cwd=self.current_dir,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout
            )
            
            execution_time = time.time() - start_time
            
            if result.returncode == 0:
                self.logger.info(f"✅ {script_name} completed successfully in {execution_time:.2f} seconds")
                print(f"   ✅ Success ({execution_time:.2f}s)")
                return True, result.stdout, execution_time
            else:
                error_msg = result.stderr or result.stdout or "Unknown error"
                self.logger.error(f"❌ {script_name} failed with code {result.returncode}: {error_msg}")
                print(f"   ❌ Failed (code {result.returncode})")
                print(f"   Error: {error_msg[:200]}...")
                return False, error_msg, execution_time
                
        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            error_msg = "Script timed out after 10 minutes"
            self.logger.error(f"⏰ {script_name} timed out")
            print(f"   ⏰ Timeout ({execution_time:.2f}s)")
            return False, error_msg, execution_time
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            self.logger.error(f"💥 {script_name} crashed: {error_msg}")
            print(f"   💥 Crashed: {error_msg}")
            return False, error_msg, execution_time
    
    def run_sequential(self) -> Dict:
        """Run all scripts sequentially."""
        print("🔄 SEQUENTIAL EXECUTION MODE")
        print("=" * 50)
        
        total_start_time = time.time()
        successful = 0
        failed = 0
        
        for i, script_info in enumerate(self.available_scripts, 1):
            print(f"\n[{i}/{len(self.available_scripts)}] ", end="")
            
            success, output, exec_time = self.run_script(script_info)
            
            self.results[script_info['name']] = {
                'success': success,
                'execution_time': exec_time,
                'output': output[:500] if output else '',
                'script': script_info['script']
            }
            
            if success:
                successful += 1
            else:
                failed += 1
                if not self.skip_errors:
                    print(f"\n❌ STOPPING: {script_info['name']} failed and --skip-errors not set")
                    break
        
        total_time = time.time() - total_start_time
        
        return {
            'total_time': total_time,
            'successful': successful,
            'failed': failed,
            'scripts_run': successful + failed,
            'total_scripts': len(self.available_scripts)
        }
    
    def run_parallel(self) -> Dict:
        """Run compatible scripts in parallel (experimental)."""
        print("⚡ PARALLEL EXECUTION MODE (Experimental)")
        print("=" * 50)
        
        # Group scripts by dependencies to avoid conflicts
        fred_scripts = [s for s in self.available_scripts if 'FRED API' in s['dependencies']]
        yahoo_scripts = [s for s in self.available_scripts if 'Yahoo Finance' in s['dependencies']]
        
        print(f"📊 FRED API scripts: {len(fred_scripts)}")
        print(f"📈 Yahoo Finance scripts: {len(yahoo_scripts)}")
        
        total_start_time = time.time()
        successful = 0
        failed = 0
        
        # Run FRED scripts first (they're usually faster)
        if fred_scripts:
            print("\n🏦 Running FRED API scripts...")
            with ThreadPoolExecutor(max_workers=2) as executor:
                future_to_script = {executor.submit(self.run_script, script): script for script in fred_scripts}
                
                for future in as_completed(future_to_script):
                    script = future_to_script[future]
                    try:
                        success, output, exec_time = future.result()
                        self.results[script['name']] = {
                            'success': success,
                            'execution_time': exec_time,
                            'output': output[:500] if output else '',
                            'script': script['script']
                        }
                        if success:
                            successful += 1
                        else:
                            failed += 1
                    except Exception as e:
                        self.logger.error(f"Parallel execution error for {script['name']}: {e}")
                        failed += 1
        
        # Run Yahoo Finance scripts
        if yahoo_scripts:
            print("\n📈 Running Yahoo Finance scripts...")
            with ThreadPoolExecutor(max_workers=2) as executor:
                future_to_script = {executor.submit(self.run_script, script): script for script in yahoo_scripts}
                
                for future in as_completed(future_to_script):
                    script = future_to_script[future]
                    try:
                        success, output, exec_time = future.result()
                        self.results[script['name']] = {
                            'success': success,
                            'execution_time': exec_time,
                            'output': output[:500] if output else '',
                            'script': script['script']
                        }
                        if success:
                            successful += 1
                        else:
                            failed += 1
                    except Exception as e:
                        self.logger.error(f"Parallel execution error for {script['name']}: {e}")
                        failed += 1
        
        total_time = time.time() - total_start_time
        
        return {
            'total_time': total_time,
            'successful': successful,
            'failed': failed,
            'scripts_run': successful + failed,
            'total_scripts': len(self.available_scripts)
        }
    
    def print_summary(self, stats: Dict):
        """Print execution summary."""
        print("\n" + "="*80)
        print("📊 EXECUTION SUMMARY")
        print("="*80)
        print(f"⏱️  Total Execution Time: {stats['total_time']:.2f} seconds ({stats['total_time']/60:.1f} minutes)")
        print(f"✅ Successful Scripts: {stats['successful']}")
        print(f"❌ Failed Scripts: {stats['failed']}")
        print(f"📊 Success Rate: {(stats['successful']/stats['scripts_run']*100):.1f}%")
        print()
        
        print("📋 DETAILED RESULTS:")
        print("-" * 50)
        
        for script_name, result in self.results.items():
            status = "✅ SUCCESS" if result['success'] else "❌ FAILED"
            print(f"{status} | {script_name:30} | {result['execution_time']:6.2f}s | {result['script']}")
        
        print("-" * 50)
        
        # Save summary to file
        summary_file = os.path.join(self.current_dir, f'etl_summary_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        summary_data = {
            'timestamp': datetime.now().isoformat(),
            'statistics': stats,
            'results': self.results,
            'configuration': {
                'dry_run': self.dry_run,
                'skip_errors': self.skip_errors,
                'total_scripts_available': len(self.etl_scripts),
                'scripts_executed': len(self.results)
            }
        }
        
        try:
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary_data, f, indent=2, default=str)
            print(f"📄 Summary saved to: {summary_file}")
        except Exception as e:
            self.logger.error(f"Failed to save summary: {e}")
        
        print("="*80)
        
        # Final status
        if stats['failed'] == 0:
            print("🎉 ALL SCRIPTS COMPLETED SUCCESSFULLY!")
        elif stats['successful'] > 0:
            print("⚠️  PARTIAL SUCCESS - Some scripts failed")
        else:
            print("💥 ALL SCRIPTS FAILED!")
        
        print("="*80 + "\n")
    
    def run(self, parallel: bool = False) -> bool:
        """Main execution method."""
        self.print_banner()
        
        if not self.available_scripts:
            print("❌ No ETL scripts found to execute!")
            return False
        
        self.print_script_summary()
        
        if not self.dry_run:
            # Verify MongoDB connection
            try:
                mongodb_url = os.getenv('MONGODB_URL')
                if not mongodb_url:
                    print("❌ MONGODB_URL not found in environment variables!")
                    return False
                print(f"🔗 MongoDB URL configured: {mongodb_url[:50]}...")
            except Exception as e:
                print(f"❌ MongoDB configuration error: {e}")
                return False
            
            # Verify FRED API key
            fred_key = os.getenv('FRED_API_KEY')
            if not fred_key:
                print("⚠️  Warning: FRED_API_KEY not found - FRED-dependent scripts may fail")
            else:
                print(f"🔑 FRED API Key configured: {fred_key[:10]}...")
        
        print("\n🚀 Starting ETL execution...\n")
        
        # Execute scripts
        if parallel:
            stats = self.run_parallel()
        else:
            stats = self.run_sequential()
        
        # Print summary
        self.print_summary(stats)
        
        return stats['failed'] == 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="SP500 Dashboard ETL Runner - Daily data gathering system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python run_all_etl.py                    # Run all scripts sequentially
    python run_all_etl.py --dry-run          # Show what would be executed
    python run_all_etl.py --parallel         # Run scripts in parallel (experimental)
    python run_all_etl.py --skip-errors      # Continue if scripts fail
    
For daily scheduling:
    - Windows: Use Task Scheduler or run_etl_daily.bat
    - Linux: Use cron or systemd timer
    - PM2: pm2 start ecosystem.config.js
        """
    )
    
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be executed without actually running')
    parser.add_argument('--parallel', action='store_true', 
                       help='Run compatible scripts in parallel (experimental)')
    parser.add_argument('--skip-errors', action='store_true', 
                       help='Continue running other scripts if one fails')
    
    args = parser.parse_args()
    
    # Create and run ETL runner
    runner = ETLRunner(dry_run=args.dry_run, skip_errors=args.skip_errors)
    success = runner.run(parallel=args.parallel)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
