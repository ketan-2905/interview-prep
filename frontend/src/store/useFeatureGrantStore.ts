import axios from "axios";
import { data } from "framer-motion/client";
import { create } from "zustand";

type PassStore = {
  open:boolean;
  setopen:(newOpen:boolean) => void;
  pass: string;
  setpass: (newpass: string) => void;
  allowed: boolean;
  loading: boolean;
  error: string|null;
  verify: () => Promise<void>;
  reset:() => void,
};

export const usePassStore = create<PassStore>((set,get) => ({
  pass: "",
  setpass: (newpass) => set({ pass: newpass }),
  open: false,
  setopen: (newopen) => set({ open: newopen }),
  allowed: false,
  loading: false,
  error:null,
  verify: async () => {
    try {
      set({loading:true,allowed:false,error:null})
      const res = await axios.post(
        `/api/verify/`,{pass:get().pass}
      );
      console.log(res);
      
      set({allowed:res.data.allowed,loading:false,open:false})

    } catch (err:any) {
      set({ error: err.message, loading: false });
    }
  },
  reset: () => {
    set({loading:false,allowed:false,error:null,pass:"",open:false})
  }
}));
