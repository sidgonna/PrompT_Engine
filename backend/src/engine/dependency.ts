// ============================================================================
// Dependency Graph — DAG construction and topological sort for step execution
// ============================================================================

import { Step } from "../models/schema";
import { extractStepRefs } from "../utils/variable-parser";

export interface DependencyEdge {
  from: string; // step.id that must execute first
  to: string;   // step.id that depends on it
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  adjacency: Map<string, string[]>;   // stepId → list of dependents
  inDegree: Map<string, number>;      // stepId → count of prerequisites
  allStepIds: string[];
}

/**
 * Build a directed acyclic graph from step dependencies.
 * Dependencies come from:
 * 1. Explicit stepRefs array (type = "ref")
 * 2. {step_<id>} patterns in template text
 *
 * @throws Error if a cycle is detected
 */
export function buildDependencyGraph(steps: Step[]): DependencyGraph {
  const stepIdSet = new Set(steps.map((s) => s.id));
  const edges: DependencyEdge[] = [];
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize maps
  for (const step of steps) {
    adjacency.set(step.id, []);
    inDegree.set(step.id, 0);
  }

  for (const step of steps) {
    const dependencies = new Set<string>();

    // 1. Explicit stepRefs (for "ref" type steps)
    if (step.stepRefs) {
      for (const ref of step.stepRefs) {
        if (stepIdSet.has(ref)) {
          dependencies.add(ref);
        }
      }
    }

    // 2. Template-embedded {step_<id>} references
    if (step.template) {
      const templateRefs = extractStepRefs(step.template);
      for (const ref of templateRefs) {
        if (stepIdSet.has(ref)) {
          dependencies.add(ref);
        }
      }
    }

    // 3. Generative instruction embedded {step_<id>} references
    if (step.generativeInstruction) {
      const genRefs = extractStepRefs(step.generativeInstruction);
      for (const ref of genRefs) {
        if (stepIdSet.has(ref)) {
          dependencies.add(ref);
        }
      }
    }

    // Add edges for all discovered dependencies
    for (const dep of dependencies) {
      edges.push({ from: dep, to: step.id });
      adjacency.get(dep)!.push(step.id);
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
    }
  }

  const graph: DependencyGraph = {
    edges,
    adjacency,
    inDegree,
    allStepIds: steps.map((s) => s.id),
  };

  // Validate no cycles
  detectCycle(graph, steps);

  return graph;
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns step IDs in a valid execution order.
 * Steps with the same dependency level are ordered by their `order` field.
 *
 * @throws Error if a cycle is detected (graph has unvisitable nodes)
 */
export function topologicalSort(
  graph: DependencyGraph,
  steps: Step[]
): string[] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map(graph.inDegree); // clone to avoid mutation
  const sorted: string[] = [];

  // Collect all nodes with in-degree 0 (no dependencies)
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  // Sort initial queue by step order for deterministic results
  queue.sort((a, b) => {
    const stepA = stepMap.get(a);
    const stepB = stepMap.get(b);
    return (stepA?.order ?? 0) - (stepB?.order ?? 0);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const dependents = graph.adjacency.get(current) ?? [];
    const newlyReady: string[] = [];

    for (const dep of dependents) {
      const newDegree = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        newlyReady.push(dep);
      }
    }

    // Sort newly ready by step order for determinism
    newlyReady.sort((a, b) => {
      const stepA = stepMap.get(a);
      const stepB = stepMap.get(b);
      return (stepA?.order ?? 0) - (stepB?.order ?? 0);
    });

    queue.push(...newlyReady);
  }

  // If not all nodes are in sorted output, there's a cycle
  if (sorted.length !== graph.allStepIds.length) {
    const unsorted = graph.allStepIds.filter((id) => !sorted.includes(id));
    const unsortedNames = unsorted
      .map((id) => stepMap.get(id)?.label ?? id)
      .join(", ");
    throw new Error(
      `Circular dependency detected among steps: [${unsortedNames}]. ` +
        `These steps have mutual or transitive dependencies that cannot be resolved.`
    );
  }

  return sorted;
}

/**
 * Detect cycles using DFS with coloring.
 * Throws an error with the cycle path if found.
 */
function detectCycle(graph: DependencyGraph, steps: Step[]): void {
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  // Colors: 0 = unvisited, 1 = in progress, 2 = done
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const id of graph.allStepIds) {
    color.set(id, 0);
    parent.set(id, null);
  }

  for (const id of graph.allStepIds) {
    if (color.get(id) === 0) {
      dfs(id);
    }
  }

  function dfs(node: string): void {
    color.set(node, 1); // mark in-progress

    const neighbors = graph.adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === 1) {
        // Found a cycle — reconstruct path
        const cyclePath: string[] = [neighbor, node];
        let current = node;
        while (parent.get(current) && parent.get(current) !== neighbor) {
          current = parent.get(current)!;
          cyclePath.push(current);
        }
        const names = cyclePath
          .map((id) => stepMap.get(id)?.label ?? id)
          .reverse()
          .join(" → ");
        throw new Error(
          `Circular dependency detected: ${names}. ` +
            `Steps cannot reference each other in a cycle.`
        );
      }

      if (color.get(neighbor) === 0) {
        parent.set(neighbor, node);
        dfs(neighbor);
      }
    }

    color.set(node, 2); // mark done
  }
}

/**
 * Get all transitive dependencies of a step (everything it needs to run first).
 */
export function getTransitiveDependencies(
  graph: DependencyGraph,
  stepId: string
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  // Reverse the adjacency: build reverse map (dependents → prerequisites)
  const reverseAdj = new Map<string, string[]>();
  for (const id of graph.allStepIds) {
    reverseAdj.set(id, []);
  }
  for (const edge of graph.edges) {
    reverseAdj.get(edge.to)!.push(edge.from);
  }

  function dfs(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const prereqs = reverseAdj.get(id) ?? [];
    for (const prereq of prereqs) {
      dfs(prereq);
      result.push(prereq);
    }
  }

  dfs(stepId);
  return result;
}
