import React, { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  Phone,
  Mail,
  User,
  Building,
  Globe,
  Shield,
  RefreshCw,
  X,
} from "lucide-react";
import { useEmployeeForm } from "@contexts/EmployeeFormContext";
import ErrorDisplay from "@components/ErrorMessage/ErrorDisplay";
import FieldError from "@components/ErrorMessage/FieldError";
import config from "../../../config";
import { toast } from "react-toastify";

const provinceData = {
  Provinces: [
    {
      name: "Central Province",
      districts: ["Kandy", "Matale", "Nuwara Eliya"],
    },
    {
      name: "Eastern Province",
      districts: ["Ampara", "Batticaloa", "Trincomalee"],
    },
    {
      name: "Northern Province",
      districts: ["Jaffna", "Kilinochchi", "Mannar", "Mullaitivu", "Vavuniya"],
    },
    {
      name: "North Central Province",
      districts: ["Anuradhapura", "Polonnaruwa"],
    },
    {
      name: "North Western Province",
      districts: ["Kurunegala", "Puttalam"],
    },
    {
      name: "Sabaragamuwa Province",
      districts: ["Kegalle", "Ratnapura"],
    },
    {
      name: "Southern Province",
      districts: ["Galle", "Matara", "Hambantota"],
    },
    {
      name: "Uva Province",
      districts: ["Badulla", "Monaragala"],
    },
    {
      name: "Western Province",
      districts: ["Colombo", "Gampaha", "Kalutara"],
    },
  ],
};

const AddressDetails = ({ onNext, onPrevious, activeCategory }) => {
  const { formData, updateFormData, errors, clearFieldError } =
    useEmployeeForm();

  // Generate strong password
  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Auto-generate password when email is entered (removed - using NIC as password)
  useEffect(() => {
    if (formData.address.email && !formData.address.password) {
      // Password will be NIC number, set automatically on backend
      updateFormData('address', { password: formData.personal?.nicNumber || '' });
    }
  }, [formData.address.email, formData.personal?.nicNumber]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Clear error for this field when user makes changes
    if (errors.address?.[name]) {
      clearFieldError("address", name);
    }

    // If province is changed, reset the district
    if (name === "province") {
      updateFormData("address", {
        [name]: value,
        district: "", // Reset district when province changes
      });
    } else {
      updateFormData("address", { [name]: value });
    }
  };

  const handleEmergencyContactChange = (e) => {
    const { name, value } = e.target;

    // Clear error for this nested field - this should work
    if (errors.address?.emergencyContact?.[name]) {
      clearFieldError("address", `emergencyContact.${name}`);
    }

    updateFormData("address", {
      emergencyContact: {
        ...formData.address.emergencyContact,
        [name]: value,
      },
    });
  };

  // Get districts based on selected province
  const getDistrictsForProvince = () => {
    if (!formData.address.province) return [];

    const selectedProvince = provinceData.Provinces.find(
      (province) => province.name === formData.address.province
    );

    return selectedProvince ? selectedProvince.districts : [];
  };

  /**
   * Emergency contact relationship types — fetch, add, edit, delete.
   */
  const EmergencyRelationshipTypesSelector = () => {
    const apiUrl = `${config.apiBaseUrl}/api/emergency-contact-relationship-types`;
    const [isLoading, setIsLoading] = useState(false);
    const [addFormVisible, setAddFormVisible] = useState(false);
    const [manageVisible, setManageVisible] = useState(false);
    const [types, setTypes] = useState([]);
    const [editingType, setEditingType] = useState(null);

    const getAuthHeaders = useCallback(() => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    }, []);

    const fetchTypes = useCallback(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(apiUrl, {
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          toast.error("Failed to fetch emergency contact relationship types.");
          return;
        }

        const data = await res.json();
        setTypes(Array.isArray(data) ? data : data.data ?? []);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Something went wrong!");
      } finally {
        setIsLoading(false);
      }
    }, [apiUrl]);

    useEffect(() => {
      fetchTypes();
    }, [fetchTypes]);

    const selectRelationship = useCallback((value) => {
      if (errors.address?.emergencyContact?.relationship) {
        clearFieldError("address", "emergencyContact.relationship");
      }
      updateFormData("address", {
        emergencyContact: {
          ...formData.address.emergencyContact,
          relationship: value,
        },
      });
    }, [formData.address.emergencyContact, errors.address?.emergencyContact?.relationship, clearFieldError, updateFormData]);

    const handleSelectChange = useCallback((e) => {
      const { value } = e.target;
      if (value === "add-new") {
        setAddFormVisible(true);
        return;
      }
      selectRelationship(value);
    }, [selectRelationship]);

    const saveNewType = useCallback(async (description) => {
      const trimmed = description.trim();
      if (!trimmed) {
        throw new Error("Description/Title cannot be empty!");
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ description: trimmed }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to create new relationship type.");
      }

      await fetchTypes();
      selectRelationship(trimmed);
      return trimmed;
    }, [apiUrl, fetchTypes, selectRelationship]);

    const updateType = useCallback(async (id, description) => {
      const trimmed = description.trim();
      if (!trimmed) {
        throw new Error("Description/Title cannot be empty!");
      }

      const res = await fetch(`${apiUrl}/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ description: trimmed }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to update relationship type.");
      }

      await fetchTypes();
      if (formData.address.emergencyContact.relationship === editingType?.description) {
        selectRelationship(trimmed);
      }
      return trimmed;
    }, [apiUrl, fetchTypes, editingType, formData.address.emergencyContact.relationship, selectRelationship]);

    const deleteType = useCallback(async (id, description) => {
      const res = await fetch(`${apiUrl}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to delete relationship type.");
      }

      await fetchTypes();
      if (formData.address.emergencyContact.relationship === description) {
        selectRelationship("");
      }
    }, [apiUrl, fetchTypes, formData.address.emergencyContact.relationship, selectRelationship]);

    const AddNewRelationshipTypeForm = ({ onClose }) => {
      const [description, setDescription] = useState("");
      const [descriptionError, setDescriptionError] = useState("");
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleSubmit = async () => {
        const trimmed = description.trim();
        if (!trimmed) {
          setDescriptionError("Description/Title cannot be empty!");
          return;
        }

        setIsSubmitting(true);
        setDescriptionError("");
        try {
          await saveNewType(trimmed);
          toast.success("New relationship type created successfully.");
          onClose();
        } catch (err) {
          console.error(err);
          const message = err instanceof Error ? err.message : "Something went wrong!";
          setDescriptionError(message);
          toast.error(message);
        } finally {
          setIsSubmitting(false);
        }
      };

      return (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Relationship</h3>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship Description/Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descriptionError) setDescriptionError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="e.g. Uncle, Guardian"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {descriptionError && <p className="text-red-500 text-sm">{descriptionError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const ManageRelationshipsModal = ({ onClose }) => {
      const [editDescription, setEditDescription] = useState("");
      const [editError, setEditError] = useState("");
      const [isSaving, setIsSaving] = useState(false);
      const [deletingId, setDeletingId] = useState(null);

      useEffect(() => {
        if (editingType) {
          setEditDescription(editingType.description || "");
          setEditError("");
        }
      }, [editingType]);

      const handleSaveEdit = async () => {
        if (!editingType) return;
        const trimmed = editDescription.trim();
        if (!trimmed) {
          setEditError("Description/Title cannot be empty!");
          return;
        }
        setIsSaving(true);
        setEditError("");
        try {
          await updateType(editingType.id, trimmed);
          toast.success("Relationship type updated.");
          setEditingType(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Update failed.";
          setEditError(message);
          toast.error(message);
        } finally {
          setIsSaving(false);
        }
      };

      const handleDelete = async (type) => {
        if (!window.confirm(`Delete relationship "${type.description}"?`)) return;
        setDeletingId(type.id);
        try {
          await deleteType(type.id, type.description);
          toast.success("Relationship type deleted.");
          if (editingType?.id === type.id) setEditingType(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Delete failed.");
        } finally {
          setDeletingId(null);
        }
      };

      return (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Manage Relationships</h3>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {types.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No relationship types yet. Use + Add to create one.</p>
              ) : (
                types.map((type) => (
                  <div key={type.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                    {editingType?.id === type.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => {
                            setEditDescription(e.target.value);
                            if (editError) setEditError("");
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          autoFocus
                        />
                        {editError && <p className="text-red-500 text-xs">{editError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={handleSaveEdit} disabled={isSaving} className="text-xs px-3 py-1 bg-blue-500 text-white rounded">
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingType(null)} className="text-xs px-3 py-1 border rounded">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-gray-800">{type.description}</span>
                        <button type="button" onClick={() => setEditingType(type)} className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(type)}
                          disabled={deletingId === type.id}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          {deletingId === type.id ? "..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Relationship <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setManageVisible(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage
            </button>
          </div>
          <div className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-10 border border-gray-300 rounded-md bg-gray-100">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500" />
              </div>
            ) : (
              <select
                name="relationship"
                value={formData.address.emergencyContact.relationship || ""}
                onChange={handleSelectChange}
                className={`w-full border ${errors.address?.emergencyContact?.relationship ? "border-red-500" : "border-gray-300"} rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white`}
              >
                <option value="">Select Relationship</option>
                {types.map((type) => (
                  <option key={type.id} value={type.description}>
                    {type.description}
                  </option>
                ))}
                <option value="add-new" className="text-blue-500 font-medium">
                  + Add New
                </option>
              </select>
            )}
          </div>
          <FieldError error={errors.address?.emergencyContact?.relationship} />
        </div>
        {addFormVisible && (
          <AddNewRelationshipTypeForm onClose={() => setAddFormVisible(false)} />
        )}
        {manageVisible && (
          <ManageRelationshipsModal onClose={() => { setManageVisible(false); setEditingType(null); }} />
        )}
      </>
    );
  };

  return (
    <div
      id="address"
      className="bg-white rounded-2xl shadow-xl overflow-hidden"
    >
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-xl">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            Address And Contact Details
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Personal Address */}
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Personal Information
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Permanent Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="permanentAddress"
                    value={formData.address.permanentAddress}
                    onChange={handleChange}
                    rows="3"
                    className={`w-full border ${errors.address?.permanentAddress
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none`}
                    placeholder="Enter permanent address"
                  />
                  <FieldError error={errors.address?.permanentAddress} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Temporary Address
                  </label>
                  <textarea
                    name="temporaryAddress"
                    value={formData.address.temporaryAddress}
                    onChange={handleChange}
                    rows="3"
                    className={`w-full border ${errors.address?.temporaryAddress
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none`}
                    placeholder="Enter temporary address"
                  />
                  <FieldError error={errors.address?.temporaryAddress} />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-600" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    NIC Number (Login Password)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      name="nicNumber"
                      type="text"
                      value={formData.personal?.nicNumber || ''}
                      readOnly
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 bg-gray-50 text-gray-700 cursor-not-allowed"
                      placeholder="NIC from personal details"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      name="email"
                      type="email"
                      value={formData.address.email}
                      onChange={handleChange}
                      className={`w-full border ${errors.address?.email
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      placeholder="Enter email address"
                    />
                  </div>
                  <FieldError error={errors.address?.email} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Land Line
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      name="landLine"
                      value={formData.address.landLine}
                      onChange={(e) => {
                        // Allow only numbers and limit to 10 digits
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        handleChange({
                          target: {
                            name: "landLine",
                            value: value,
                          },
                        });
                      }}
                      className={`w-full border ${errors.address?.landLine
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      placeholder="Enter land line number"
                    />
                  </div>
                  <FieldError error={errors.address?.landLine} />
                  {formData.address.landLine &&
                    formData.address.landLine.length !== 10 && (
                      <p className="text-red-500 text-xs mt-1">
                        Land line must be 10 digits
                      </p>
                    )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Mobile Line <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      name="mobileLine"
                      value={formData.address.mobileLine}
                      onChange={(e) => {
                        // Allow only numbers and limit to 10 digits
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        handleChange({
                          target: {
                            name: "mobileLine",
                            value: value,
                          },
                        });
                      }}
                      className={`w-full border ${errors.address?.mobileLine
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <FieldError error={errors.address?.mobileLine} />
                  {formData.address.mobileLine &&
                    formData.address.mobileLine.length !== 10 && (
                      <p className="text-red-500 text-xs mt-1">
                        Mobile number must be 10 digits
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Location & Emergency */}
          <div className="space-y-6">
            {/* Location Details */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                Location Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="province"
                    value={formData.address.province}
                    onChange={handleChange}
                    className={`w-full border ${errors.address?.province
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white`}
                  >
                    <option value="">Select Province</option>
                    {provinceData.Provinces.map((province, index) => (
                      <option key={index} value={province.name}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                  <FieldError error={errors.address?.province} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Electoral Division
                  </label>
                  <input
                    name="electoralDivision"
                    value={formData.address.electoralDivision}
                    onChange={handleChange}
                    className={`w-full border ${errors.address?.electoralDivision
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                    placeholder="Enter electoral division"
                  />
                  <FieldError error={errors.address?.electoralDivision} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    GN Division
                  </label>
                  <input
                    name="gnDivision"
                    value={formData.address.gnDivision}
                    onChange={handleChange}
                    className={`w-full border ${errors.address?.gnDivision
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                    placeholder="Enter GN division"
                  />
                  <FieldError error={errors.address?.gnDivision} />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Police Station
                  </label>
                  <input
                    name="policeStation"
                    value={formData.address.policeStation}
                    onChange={handleChange}
                    className={`w-full border ${errors.address?.policeStation
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                    placeholder="Enter police station"
                  />
                  <FieldError error={errors.address?.policeStation} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="district"
                    value={formData.address.district}
                    onChange={handleChange}
                    disabled={!formData.address.province}
                    className={`w-full border ${errors.address?.district
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white ${!formData.address.province
                        ? "opacity-70 cursor-not-allowed"
                        : ""
                      }`}
                  >
                    <option value="">Select District</option>
                    {getDistrictsForProvince().map((district, index) => (
                      <option key={index} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  <FieldError error={errors.address?.district} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Emergency Contact
              </h3>

              <div className="space-y-4">
                <EmergencyRelationshipTypesSelector />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="contactName"
                    value={formData.address.emergencyContact.contactName}
                    onChange={handleEmergencyContactChange}
                    className={`w-full border ${errors.address?.emergencyContact?.contactName
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                    placeholder="Enter contact name"
                  />
                  <FieldError
                    error={errors.address?.emergencyContact?.contactName}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Address
                    {/* <span className="text-red-500">*</span> */}
                  </label>
                  <textarea
                    name="contactAddress"
                    value={formData.address.emergencyContact.contactAddress}
                    onChange={handleEmergencyContactChange}
                    rows="2"
                    className={`w-full border ${errors.address?.emergencyContact?.contactAddress
                      ? "border-red-500"
                      : "border-gray-300"
                      } rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none`}
                    placeholder="Enter contact address"
                  />
                  <FieldError
                    error={errors.address?.emergencyContact?.contactAddress}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Contact Tel <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      name="contactTel"
                      value={formData.address.emergencyContact.contactTel}
                      onChange={(e) => {
                        // Allow only numbers and limit to 10 digits
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        handleEmergencyContactChange({
                          target: {
                            name: "contactTel",
                            value: value,
                          },
                        });
                      }}
                      className={`w-full border ${errors.address?.emergencyContact?.contactTel
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                      placeholder="Enter contact telephone"
                    />
                  </div>
                  <FieldError
                    error={errors.address?.emergencyContact?.contactTel}
                  />
                  {formData.address.emergencyContact.contactTel &&
                    formData.address.emergencyContact.contactTel.length !==
                    10 && (
                      <p className="text-red-500 text-xs mt-1">
                        Contact number must be 10 digits
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={onPrevious}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressDetails;
