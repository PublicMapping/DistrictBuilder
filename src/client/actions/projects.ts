import { createAction } from "typesafe-actions";
import { IProject, ProjectId } from "../../shared/entities";

export const projectsFetch = createAction("Projects fetch")();
export const projectsFetchSuccess = createAction("Projects fetch success")<readonly IProject[]>();
export const projectsFetchFailure = createAction("Projects fetch failure")<string>();

export const setDeleteProject = createAction("Set the id for the delete project modal")<
  IProject | undefined
>();

export const projectArchive = createAction("Archive project")<ProjectId>();
export const projectArchiveSuccess = createAction("Archive project success")<IProject>();
export const projectArchiveFailure = createAction("Archive project failure")<string>();
