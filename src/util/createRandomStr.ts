import dayjs from "dayjs";

export default function createRandomStr(){
  return dayjs().format('YYYYMDD_HHmmss') + Math.random().toString(36).slice(-5)
}