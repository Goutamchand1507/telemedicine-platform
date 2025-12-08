#!/usr/bin/env python3
"""
Enhanced script to copy metrics from one agent to another using API calls.
Features:
1. Uses GET API for individual metrics to fetch custom_code
2. Updates existing metrics if name matches instead of creating duplicates
3. Skips Vocera-defined metrics

Usage:
    python copy_metrics_script.py
"""

import requests

# Configuration
BASE_URL = "https://backend.usesynth.co"  # Change this to your API URL
API_KEY = "ce63f0ca9a3a21a7bda15575db4d58263d68f32f131c1932adbd565134c4336e"  # Change this to your API key
SOURCE_AGENT_ID = 161  # Change this to source agent ID
TARGET_AGENT_ID = 272  # Change this to target agent ID

def copy_metrics():
    """Fetch metrics from source agent and create/update them on target agent."""

    headers = {
        'X-CEKURA-API-KEY': f'{API_KEY}',
        'Content-Type': 'application/json'
    }

    # Step 1: Get list of metric IDs from source agent
    print(f"Fetching metrics list from source agent {SOURCE_AGENT_ID}...")
    list_url = f"{BASE_URL}/test_framework/v1/metrics/?agent_id={SOURCE_AGENT_ID}"

    response = requests.get(list_url, headers=headers)

    if response.status_code != 200:
        print(f"Error fetching metrics list: {response.status_code}")
        print(response.text)
        return

    source_metrics_list = response.json()

    if not isinstance(source_metrics_list, list):
        print(f"Unexpected response format. Expected list, got: {type(source_metrics_list)}")
        return

    print(f"Found {len(source_metrics_list)} metrics in source agent\n")

    if not source_metrics_list:
        print("No metrics to copy")
        return

    # Step 2: Get list of existing metrics from target agent
    print(f"Fetching existing metrics from target agent {TARGET_AGENT_ID}...")
    target_list_url = f"{BASE_URL}/test_framework/v1/metrics/?agent_id={TARGET_AGENT_ID}"

    response = requests.get(target_list_url, headers=headers)

    if response.status_code != 200:
        print(f"Error fetching target metrics: {response.status_code}")
        print(response.text)
        return

    target_metrics_list = response.json()

    # Create a mapping of metric names to their IDs in target agent
    target_metrics_map = {}
    if isinstance(target_metrics_list, list):
        for metric in target_metrics_list:
            metric_name = metric.get('name')
            metric_id = metric.get('id')
            if metric_name and metric_id:
                target_metrics_map[metric_name] = metric_id

    print(f"Found {len(target_metrics_map)} existing metrics in target agent\n")

    # Step 3: Process each metric
    post_url = f"{BASE_URL}/test_framework/v1/metrics/"
    copied = 0
    updated = 0
    skipped = 0
    skipped_vocera = 0

    for metric_summary in source_metrics_list:
        metric_id = metric_summary.get('id')
        metric_name = metric_summary.get('name', 'Unknown')

        # Skip if no ID
        if not metric_id:
            print(f"⊘ Skipped: {metric_name} (No ID)")
            skipped += 1
            continue

        # Step 3a: Get full metric details using GET API
        print(f"Fetching details for metric: {metric_name} (ID: {metric_id})...")
        get_metric_url = f"{BASE_URL}/test_framework/v1/metrics/{metric_id}/"

        response = requests.get(get_metric_url, headers=headers)

        if response.status_code != 200:
            print(f"✗ Failed to fetch details for: {metric_name}")
            print(f"  Status: {response.status_code}")
            skipped += 1
            continue

        metric = response.json()
        vocera_code = metric.get('vocera_defined_metric_code')

        # Skip metrics that have vocera_defined_metric_code
        if vocera_code is not None and vocera_code != '':
            print(f"⊘ Skipped (Vocera metric): {metric_name} (Code: {vocera_code})")
            skipped_vocera += 1
            continue

        # Prepare data for POST/PUT request - only include fields from MetricEditSerializer
        metric_data = {
            'agent': TARGET_AGENT_ID,
            'name': metric.get('name'),
            'description': metric.get('description', ''),
            'type': metric.get('type'),
            'eval_type': metric.get('eval_type'),
            'prompt': metric.get('prompt', ''),
            'function_name': metric.get('function_name', ''),
        }

        # Add optional fields that exist in MetricEditSerializer
        optional_fields = [
            'audio_enabled', 'observability_enabled', 'simulation_enabled',
            'enum_values', 'display_order', 'custom_code',
            'evaluation_trigger', 'evaluation_trigger_prompt',
            'vocera_defined_metric_code', 'priority_assignment_prompt',
            'configuration', 'kb_file_ids',
            'metric_description_program', 'metric_description_variables',
            'evaluation_trigger_program', 'evaluation_trigger_variables'
        ]

        for field in optional_fields:
            if field in metric and metric[field] is not None:
                metric_data[field] = metric[field]

        # Step 3b: Check if metric with same name exists in target agent
        if metric_name in target_metrics_map:
            # Update existing metric using PATCH method
            target_metric_id = target_metrics_map[metric_name]
            update_url = f"{BASE_URL}/test_framework/v1/metrics/{target_metric_id}/"

            response = requests.patch(update_url, headers=headers, json=metric_data)

            if response.status_code in [200, 201]:
                print(f"↻ Updated: {metric_name} (Target ID: {target_metric_id})")
                updated += 1
            else:
                print(f"✗ Failed to update: {metric_name}")
                print(f"  Status: {response.status_code}")
                print(f"  Error: {response.text[:200]}")
                skipped += 1
        else:
            # Create new metric
            response = requests.post(post_url, headers=headers, json=metric_data)

            if response.status_code in [200, 201]:
                new_id = response.json().get('id')
                print(f"✓ Copied: {metric_name} (Source ID: {metric_id} → Target ID: {new_id})")
                copied += 1
            else:
                print(f"✗ Failed to copy: {metric_name}")
                print(f"  Status: {response.status_code}")
                print(f"  Error: {response.text[:200]}")
                skipped += 1

    print(f"\n{'='*70}")
    print(f"Summary:")
    print(f"  Total metrics found in source: {len(source_metrics_list)}")
    print(f"  Successfully copied (new): {copied}")
    print(f"  Successfully updated (existing): {updated}")
    print(f"  Skipped (Vocera metrics): {skipped_vocera}")
    print(f"  Failed: {skipped}")
    print(f"{'='*70}")

if __name__ == '__main__':
    copy_metrics()
