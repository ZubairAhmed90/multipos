'use client'

import { useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

const useEntityCRUD = (sliceName, entityName = 'entity') => {
  const dispatch = useDispatch()
  
  // Use separate selectors for each property to avoid object recreation
  const data = useSelector(useCallback((state) => {
    const sliceState = state[sliceName]
    return sliceState?.data || []
  }, [sliceName]))
  
  const loading = useSelector(useCallback((state) => {
    const sliceState = state[sliceName]
    return sliceState?.loading || false
  }, [sliceName]))
  
  const error = useSelector(useCallback((state) => {
    const sliceState = state[sliceName]
    return sliceState?.error || null
  }, [sliceName]))
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [isEdit, setIsEdit] = useState(false)

  // Form dialog handlers
  const handleAdd = useCallback(() => {
    setSelectedEntity(null)
    setIsEdit(false)
    setFormDialogOpen(true)
  }, [])

  const handleEdit = useCallback((entity) => {
    setSelectedEntity(entity)
    setIsEdit(true)
    setFormDialogOpen(true)
  }, [])

  const handleView = useCallback((entity) => {
    setSelectedEntity(entity)
    setIsEdit(false)
    setFormDialogOpen(true)
  }, [])

  const handleFormClose = useCallback(() => {
    setFormDialogOpen(false)
    setSelectedEntity(null)
    setIsEdit(false)
  }, [])

  // Confirmation dialog handlers
  const handleDeleteClick = useCallback((entity) => {
    setSelectedEntity(entity)
    setConfirmationDialogOpen(true)
  }, [])

  const handleConfirmationClose = useCallback(() => {
    setConfirmationDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  // CRUD operations
  const handleCreate = useCallback((formData) => {
    dispatch({ type: `${sliceName}/create`, payload: formData })
    handleFormClose()
  }, [dispatch, sliceName, handleFormClose])

  const handleUpdate = useCallback((formData) => {
    dispatch({ type: `${sliceName}/update`, payload: { id: selectedEntity.id, data: formData } })
    handleFormClose()
  }, [dispatch, sliceName, selectedEntity, handleFormClose])

  const handleDelete = useCallback(() => {
    dispatch({ type: `${sliceName}/delete`, payload: selectedEntity.id })
    handleConfirmationClose()
  }, [dispatch, sliceName, selectedEntity, handleConfirmationClose])

  // Combined form submit handler
  const handleFormSubmit = useCallback((formData) => {
    if (isEdit) {
      handleUpdate(formData)
    } else {
      handleCreate(formData)
    }
  }, [isEdit, handleUpdate, handleCreate])

  return {
    // Data
    data,
    loading,
    error,
    
    // Dialog states
    formDialogOpen,
    confirmationDialogOpen,
    selectedEntity,
    isEdit,
    
    // Handlers
    handleAdd,
    handleEdit,
    handleView,
    handleDeleteClick,
    handleFormClose,
    handleConfirmationClose,
    handleFormSubmit,
    handleDelete,
    
    // Computed values
    dialogTitle: isEdit ? `Edit ${entityName}` : `Add ${entityName}`,
    confirmationTitle: `Delete ${entityName}`,
    confirmationMessage: `Are you sure you want to delete this ${entityName}? This action cannot be undone.`,
  }
}

export default useEntityCRUD
