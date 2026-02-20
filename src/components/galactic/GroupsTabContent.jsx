import React from "react";
import ProfileAvatar from "./ProfileAvatar.jsx";
import GroupList from "./GroupList.jsx";
import GroupChatPanel from "./GroupChatPanel.jsx";
import { FOOTBALL_FORMATIONS_BY_COUNT } from "./footballFormations.js";

/**
 * Reusable groups tab UI: members card, group list / chat, team (formation + slots), leave.
 * Receives all data and handlers from useGroups().
 */
export default function GroupsTabContent({
  currentUser,
  myGroups,
  loadingMyGroups,
  unreadCountByGroupId,
  selectedGroupId,
  setSelectedGroupId,
  selectedGroup,
  isSelectedGroupOwner,
  groupTeam,
  loadingGroupTeam,
  teamSlots,
  loadingTeamSlots,
  groupMessages,
  loadingGroupMessages,
  groupMembers,
  loadingGroupMembers,
  groupMemberUserIds,
  groupMemberProfileMap,
  groupMemberProfiles,
  groupSenderProfileMap,
  groupMessageDraft,
  setGroupMessageDraft,
  friendIdsToAdd,
  setFriendIdsToAdd,
  isFriendPickerOpen,
  setIsFriendPickerOpen,
  memberToRemoveId,
  setMemberToRemoveId,
  newTeamName,
  setNewTeamName,
  newTeamStarters,
  setNewTeamStarters,
  slotAssigningId,
  setSlotAssigningId,
  friends,
  handleCreateGroup,
  handleSendGroupMessage,
  handleAddFriendToGroup,
  handleCreateTeam,
  handleSetFormation,
  handleAssignSlot,
  handleDeleteTeam,
  handleRemoveMemberFromGroup,
  handleLeaveGroup,
  createGroupMutation,
  addGroupMemberMutation,
  removeGroupMemberMutation,
  sendGroupMessageMutation,
  createTeamMutation,
  setFormationMutation,
  assignSlotMutation,
  deleteTeamMutation,
}) {
  return (
    <>
      {selectedGroupId && (
        <div className="card-spotbulle-dark p-3 border border-slate-700">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Membres du groupe
              </p>
              {loadingGroupMembers ? (
                <p className="text-xs text-slate-500">
                  Chargement des membres...
                </p>
              ) : groupMemberUserIds.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aucun membre pour le moment.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groupMemberUserIds
                    .filter((uid) => uid !== currentUser?.id)
                    .map((uid) => {
                      const m = groupMemberProfileMap[uid];
                      return (
                        <div key={uid} className="flex items-center">
                          <ProfileAvatar
                            profile={m}
                            size={28}
                            title={m?.full_name || "Utilisateur"}
                          />
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {(() => {
              if (!isSelectedGroupOwner) return null;
              const memberIdSet = new Set(groupMemberUserIds);
              const availableFriends =
                friends?.filter(
                  (f) => !memberIdSet.has(f.id) && f.id !== currentUser?.id,
                ) || [];
              const removableMembers = groupMemberUserIds.filter(
                (uid) =>
                  uid !== currentUser?.id && uid !== selectedGroup?.owner_id,
              );
              const removableMemberOptions = removableMembers
                .map((uid) => groupMemberProfileMap[uid])
                .filter(Boolean);
              if (
                !availableFriends.length &&
                !removableMemberOptions.length
              )
                return null;
              return (
                <div className="flex flex-col gap-3">
                  {availableFriends.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-slate-400">
                        Ajouter des amis au groupe :
                      </p>
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            setIsFriendPickerOpen((open) => !open)
                          }
                          className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                        >
                          <span className="truncate">
                            {friendIdsToAdd.length === 0
                              ? "Ajouter des amis"
                              : `${friendIdsToAdd.length} ami(s) sélectionné(s)`}
                          </span>
                          <svg
                            className="w-3 h-3 text-slate-300"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        {isFriendPickerOpen && (
                          <div className="absolute z-20 mt-1 w-56 rounded-md bg-slate-900 border border-slate-700 shadow-lg max-h-56 overflow-y-auto">
                            {availableFriends.map((f) => {
                              const checked = friendIdsToAdd.includes(f.id);
                              return (
                                <label
                                  key={f.id}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-600 bg-slate-800"
                                    checked={checked}
                                    onChange={(e) => {
                                      setFriendIdsToAdd((prev) => {
                                        if (e.target.checked) {
                                          return prev.includes(f.id)
                                            ? prev
                                            : [...prev, f.id];
                                        }
                                        return prev.filter(
                                          (id) => id !== f.id,
                                        );
                                      });
                                    }}
                                  />
                                  <span className="truncate">
                                    {f.full_name || "Utilisateur"}
                                  </span>
                                </label>
                              );
                            })}
                            {availableFriends.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-500">
                                Aucun ami disponible.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddFriendToGroup}
                        disabled={
                          !friendIdsToAdd.length ||
                          addGroupMemberMutation.isLoading
                        }
                        className="px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  )}

                  {removableMemberOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-slate-400">
                        Retirer un membre :
                      </p>
                      <select
                        className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                        value={memberToRemoveId || ""}
                        onChange={(e) =>
                          setMemberToRemoveId(
                            e.target.value ? e.target.value : null,
                          )
                        }
                      >
                        <option value="">Sélectionner un membre</option>
                        {removableMemberOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name || "Utilisateur"}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleRemoveMemberFromGroup}
                        disabled={
                          !memberToRemoveId ||
                          removeGroupMemberMutation.isLoading
                        }
                        className="px-3 py-1.5 text-xs rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      <div className="min-h-[420px] space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-4 lg:items-stretch">
        <div className="lg:h-full lg:flex lg:flex-col lg:min-h-0">
          {!selectedGroupId ? (
            <GroupList
              groups={myGroups}
              loading={loadingMyGroups}
              onSelectGroup={setSelectedGroupId}
              onCreateGroup={handleCreateGroup}
              createLoading={createGroupMutation.isLoading}
              unreadCountByGroupId={unreadCountByGroupId}
            />
          ) : (
            <GroupChatPanel
              groupId={selectedGroupId}
              groupName={selectedGroup?.name}
              messages={groupMessages}
              loadingMessages={loadingGroupMessages}
              currentUserId={currentUser?.id}
              senderProfiles={groupSenderProfileMap}
              messageDraft={groupMessageDraft}
              onMessageDraftChange={setGroupMessageDraft}
              onSendMessage={handleSendGroupMessage}
              sendLoading={sendGroupMessageMutation.isLoading}
              onBack={() => setSelectedGroupId(null)}
              containerHeight="650px"
              memberCount={groupMemberUserIds.length}
              isOwner={isSelectedGroupOwner}
            />
          )}
        </div>
        <div className="space-y-4">
          {selectedGroupId && (
            <div className="card-spotbulle-dark p-3 border border-slate-700">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">
                      Équipe du groupe
                    </p>
                    {groupTeam && (
                      <p className="text-[11px] text-slate-400">
                        {groupTeam.starters_count} joueurs
                        {groupTeam.formation
                          ? ` · ${groupTeam.formation}`
                          : " · formation à définir"}
                      </p>
                    )}
                  </div>
                  {groupTeam && isSelectedGroupOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteTeam}
                      disabled={deleteTeamMutation.isLoading}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Supprimer l&apos;équipe
                    </button>
                  )}
                </div>

                {loadingGroupTeam ? (
                  <p className="text-xs text-slate-500">
                    Chargement de l&apos;équipe...
                  </p>
                ) : !groupTeam ? (
                  isSelectedGroupOwner ? (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nom de l&apos;équipe
                        </label>
                        <input
                          type="text"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="Equipe du groupe"
                          className="w-full px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nombre de joueurs
                        </label>
                        <select
                          value={newTeamStarters}
                          onChange={(e) =>
                            setNewTeamStarters(Number(e.target.value) || 11)
                          }
                          className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100"
                        >
                          <option value={5}>5</option>
                          <option value={7}>7</option>
                          <option value={11}>11</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateTeam}
                        disabled={createTeamMutation.isLoading}
                        className="px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                      >
                        Créer l&apos;équipe
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Aucune équipe n&apos;a encore été créée pour ce groupe.
                    </p>
                  )
                ) : (
                  <>
                    {isSelectedGroupOwner && (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-slate-400">Formation :</p>
                        {(() => {
                          const formationsForCount =
                            FOOTBALL_FORMATIONS_BY_COUNT[
                              groupTeam.starters_count
                            ] ||
                            FOOTBALL_FORMATIONS_BY_COUNT[
                              String(groupTeam.starters_count)
                            ] ||
                            {};
                          const formationNames =
                            Object.keys(formationsForCount);
                          if (!formationNames.length) {
                            return (
                              <span className="text-xs text-slate-500">
                                Aucune formation définie pour{" "}
                                {groupTeam.starters_count} joueurs.
                              </span>
                            );
                          }
                          return (
                            <select
                              value={groupTeam.formation || ""}
                              onChange={(e) =>
                                handleSetFormation(e.target.value || null)
                              }
                              className="px-2 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100"
                            >
                              <option value="">
                                Choisir une formation
                              </option>
                              {formationNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    )}

                    {groupTeam.formation && (
                      <div className="mt-2">
                        {loadingTeamSlots ? (
                          <p className="text-xs text-slate-500">
                            Chargement des postes...
                          </p>
                        ) : !teamSlots.length ? (
                          <p className="text-xs text-slate-500">
                            Aucune position définie pour cette formation.
                          </p>
                        ) : (
                          <div className="relative w-full aspect-[2/2] bg-gradient-to-b from-emerald-900 to-emerald-800 rounded-xl border border-emerald-500/60 overflow-hidden">
                            <div className="absolute inset-x-4 inset-y-4 border border-emerald-500/40 rounded-xl" />
                            <div className="absolute inset-x-1/2 top-0 bottom-0 border-l border-emerald-500/40" />
                            <div className="absolute inset-x-8 top-1/2 border-t border-emerald-500/40" />
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-emerald-500/50" />
                            {teamSlots.map((slot) => {
                              const assignedProfile =
                                slot.user_id &&
                                groupMemberProfileMap[slot.user_id];
                              const left = `${slot.x * 100}%`;
                              const bottom = `${slot.y * 100}%`;
                              const isClickable = isSelectedGroupOwner;
                              const isSelectedSlot =
                                slotAssigningId === slot.id;
                              return (
                                <button
                                  key={slot.index}
                                  type="button"
                                  className={`absolute -translate-x-1/2 translate-y-1/2 flex items-center justify-center rounded-full border-2 ${
                                    assignedProfile
                                      ? "border-white"
                                      : "border-emerald-300/80"
                                  } ${
                                    isClickable
                                      ? "cursor-pointer hover:scale-105 transition-transform"
                                      : "cursor-default"
                                  } ${
                                    isSelectedSlot
                                      ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-emerald-900"
                                      : ""
                                  }`}
                                  style={{
                                    left,
                                    bottom,
                                    width: 40,
                                    height: 40,
                                    backgroundColor: assignedProfile
                                      ? "rgba(15, 23, 42, 0.9)"
                                      : "rgba(16, 185, 129, 0.85)",
                                    transition:
                                      "left 320ms ease, bottom 320ms ease, transform 180ms ease",
                                  }}
                                  onClick={() => {
                                    if (!isClickable) return;
                                    setSlotAssigningId(slot.id);
                                  }}
                                >
                                  {assignedProfile ? (
                                    <ProfileAvatar
                                      profile={assignedProfile}
                                      size={32}
                                      title={
                                        assignedProfile.full_name || "Joueur"
                                      }
                                    />
                                  ) : (
                                    <span className="text-[11px] font-semibold text-slate-900">
                                      {slot.role || slot.index + 1}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {groupTeam.formation &&
                      (() => {
                        const assignedIds = new Set(
                          teamSlots.map((s) => s.user_id).filter(Boolean),
                        );
                        const benchPlayers = (
                          groupMemberProfiles || []
                        ).filter((p) => !assignedIds.has(p.id));
                        if (!benchPlayers.length) return null;
                        return (
                          <div className="mt-3">
                            <p className="text-[11px] text-slate-400 mb-1">
                              Remplaçants
                            </p>
                            {isSelectedGroupOwner && slotAssigningId && (
                              <p className="text-[11px] text-slate-400 mb-1">
                                Poste sélectionné :{" "}
                                <span className="font-semibold text-slate-200">
                                  {(() => {
                                    const s = teamSlots.find(
                                      (x) => x.id === slotAssigningId,
                                    );
                                    return (
                                      s?.role || `#${(s?.index || 0) + 1}`
                                    );
                                  })()}
                                </span>
                                . Choisis un joueur ci-dessous ou via le
                                sélecteur.
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {benchPlayers.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={`flex items-center justify-center rounded-full border-2 border-slate-500/70 bg-slate-800 hover:bg-slate-700/90 transition-colors ${
                                    isSelectedGroupOwner
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                  style={{ width: 32, height: 32 }}
                                  onClick={() => {
                                    if (!isSelectedGroupOwner) return;
                                    if (!slotAssigningId) return;
                                    handleAssignSlot(slotAssigningId, p.id);
                                  }}
                                  title={p.full_name || "Remplaçant"}
                                >
                                  <ProfileAvatar profile={p} size={24} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                    {isSelectedGroupOwner &&
                      slotAssigningId &&
                      (() => {
                        const slot = teamSlots.find(
                          (s) => s.id === slotAssigningId,
                        );
                        if (!slot) return null;
                        const assignedIds = new Set(
                          teamSlots
                            .map((s) => s.user_id)
                            .filter((id) => id && id !== slot.user_id),
                        );
                        const availablePlayers = (
                          groupMemberProfiles || []
                        ).filter((p) => !assignedIds.has(p.id));
                        if (!availablePlayers.length) {
                          return (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Aucun membre disponible à assigner à ce poste.
                            </p>
                          );
                        }
                        return (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-slate-400">
                              Choisir un joueur pour ce poste :
                            </p>
                            <select
                              className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-xs text-slate-100 min-w-[200px]"
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                handleAssignSlot(slot.id, e.target.value);
                                e.target.value = "";
                              }}
                            >
                              <option value="">
                                Sélectionner un joueur
                              </option>
                              {availablePlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name || "Utilisateur"}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setSlotAssigningId(null)}
                              className="text-[11px] text-slate-400 hover:text-slate-200"
                            >
                              Annuler
                            </button>
                          </div>
                        );
                      })()}
                  </>
                )}
              </div>
            </div>
          )}
          {selectedGroupId && !isSelectedGroupOwner && (
            <div>
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="text-xs text-rose-400 hover:text-rose-300 underline"
              >
                Quitter ce groupe
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
