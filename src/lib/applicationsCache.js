// A mutation can finish while a shared board-initial request is in flight.
// Invalidation alone only restarts active column queries; they would reuse the
// inactive shared request and render its pre-mutation response. Cancel the
// entire applications prefix first, then refresh all mounted consumers.
export async function refreshApplications(qc) {
  await qc.cancelQueries({ queryKey: ['applications'] });
  return qc.invalidateQueries({ queryKey: ['applications'] });
}
