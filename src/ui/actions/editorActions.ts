import { buildActionCreator } from "hard-reducer"
import path from "path"
import * as FS from "../../domain/filesystem"
import * as Git from "../../domain/git"
import * as GitActions from "../reducers/git"
import * as ProjectActions from "../reducers/project"
import * as RepositoryActions from "../reducers/repository"
import { RootState } from "./../reducers"

// Action
const {
  createAsyncAction,
  createAction,
  createThunkAction
} = buildActionCreator({
  prefix: "editor/"
})

export const createFile = createThunkAction(
  "create-file",
  async (
    {
      filepath,
      content = ""
    }: {
      filepath: string
      content?: string
    },
    dispatch
  ) => {
    await FS.writeFile(filepath, content)
    dispatch(startUpdate({ changedPath: filepath }))
  }
)

export const createDirectory = createThunkAction(
  "create-directory",
  async ({ dirname }: { dirname: string }, dispatch) => {
    await FS.mkdir(dirname)
    dispatch(startUpdate({ changedPath: dirname, isDir: true }))
  }
)

export const deleteFile = createThunkAction(
  "delete-file",
  async ({ filename }: { filename: string }, dispatch) => {
    await FS.unlink(filename)
    dispatch(startUpdate({ changedPath: filename }))
  }
)

export const deleteDirectory = createThunkAction(
  "delete-directory",
  async ({ dirpath }: { dirpath: string }, dispatch) => {
    await FS.removeDirectory(dirpath)
    dispatch(startUpdate({ changedPath: dirpath }))
  }
)

export const addToStage = createThunkAction(
  "add-to-stage",
  async (
    {
      projectRoot,
      relpath
    }: {
      projectRoot: string
      relpath: string
    },
    dispatch
  ) => {
    await Git.addFile(projectRoot, relpath)
    dispatch(startUpdate({ changedPath: path.join(projectRoot, relpath) }))
  }
)

export const removeFileFromGit = createThunkAction(
  "remove-file-from-git",
  async (
    {
      projectRoot,
      relpath
    }: {
      projectRoot: string
      relpath: string
    },
    dispatch
  ) => {
    await Git.removeFromGit(projectRoot, relpath)
    dispatch(startUpdate({ changedPath: path.join(projectRoot, relpath) }))
  }
)

// Thunked: move later
export const deleteProject = createThunkAction(
  "delete-project",
  async ({ dirpath }: { dirpath: string }, dispatch) => {
    await FS.removeDirectory(dirpath)
    dispatch(await ProjectActions.loadProjectList({}))
  }
)

export const finishFileCreating = createThunkAction(
  "finish-file-creating",
  async ({ filepath }: { filepath: string }, dispatch) => {
    await FS.writeFile(filepath, "")
    dispatch(RepositoryActions.endFileCreating({ filepath }))
    dispatch(startUpdate({ changedPath: filepath }))
  }
)

export const finishDirCreating = createThunkAction(
  "finish-dir-creating",
  async ({ dirpath }: { dirpath: string }, dispatch) => {
    await FS.mkdir(dirpath)
    dispatch(RepositoryActions.endDirCreating({ dirpath }))
    dispatch(startUpdate({ changedPath: dirpath, isDir: true }))
  }
)

export const startUpdate = createThunkAction(
  "start-changed",
  async (
    {
      changedPath,
      isDir = false
    }: {
      changedPath?: string
      isDir?: boolean
    },
    dispatch,
    getState: () => RootState
  ) => {
    dispatch(RepositoryActions.changed({}))
    if (isDir === false && changedPath) {
      const state = getState()
      const projectRoot = state.repository.currentProjectRoot
      const relpath = path.relative(projectRoot, changedPath)
      if (!relpath.startsWith("..")) {
        dispatch(GitActions.startStagingUpdate(projectRoot, [relpath]))
      }
    }
  }
)

export const startProjectRootChanged = createThunkAction(
  "start-project-root-changed",
  async ({ projectRoot }: { projectRoot: string }, dispatch) => {
    dispatch(RepositoryActions.projectRootChanged({ projectRoot }))
    dispatch(await GitActions.initialize(projectRoot))
  }
)

export async function pushCurrentBranchToOrigin(
  projectRoot: string,
  branch: string
) {
  return async (dispatch: any, getState: () => RootState) => {
    const state = getState()
    const githubToken = state.config.githubApiToken
    if (githubToken.length > 0) {
      await Git.pushBranch(projectRoot, "origin", branch, githubToken)
      console.log("push succeeded")
      dispatch(startUpdate({}))
    } else {
      console.error("push failed")
    }
  }
}
